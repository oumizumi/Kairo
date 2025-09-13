import os
import uuid
from unittest.mock import patch, MagicMock

from django.contrib.auth.models import User
from django.urls import reverse
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.db import IntegrityError
from django.test import TestCase as DjangoTestCase # For model tests not needing API client

from rest_framework.test import APITestCase
from rest_framework import status
from datetime import date, time, timezone

from .models import Professor, Course, CourseProfessorLink, Message, ImportantDate, ExamEvent, Term, CourseOffering
from .serializers import ImportantDateSerializer, ExamEventSerializer
from .views import MessageView  # Add this import
import openai # For type hinting and error classes

# Existing UserAuthTests
class UserAuthTests(APITestCase):

    @classmethod
    def setUpTestData(cls):
        cls.test_user_username = 'testuser'
        cls.test_user_email = 'test@example.com'
        cls.test_user_password = 'StrongPassword123'
        
        cls.user = User.objects.create_user(
            username=cls.test_user_username,
            email=cls.test_user_email,
            password=cls.test_user_password,
            first_name="Test",
            last_name="User"
        )

        cls.register_url = reverse('api:user-register')
        cls.login_url = reverse('api:token-obtain-pair')
        cls.refresh_url = reverse('api:token-refresh')
        cls.profile_update_url = reverse('api:profile-update')
        cls.password_reset_request_url = reverse('api:password-reset-request')
        cls.password_reset_confirm_url = reverse('api:password-reset-confirm')

    def setUp(self):
        self.client = self.client_class() 
        self.another_user_data = {
            'username': 'anotheruser',
            'email': 'another@example.com',
            'password': 'AnotherPassword123'
        }

    def _get_tokens_for_user(self, username, password):
        response = self.client.post(self.login_url, {'username': username, 'password': password})
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)
        return response.data

    def test_user_registration_success(self):
        data = {'username': 'newuser', 'email': 'new@example.com', 'password': 'NewPassword123'}
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username='newuser').exists())

    def test_user_registration_missing_email(self):
        data = {'username': 'newuser2', 'password': 'NewPassword123'}
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_user_registration_missing_password(self):
        data = {'username': 'newuser3', 'email': 'new3@example.com'}
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_user_registration_existing_username(self):
        data = {'username': self.test_user_username, 'email': 'unique_email@example.com', 'password': 'Password123'}
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_user_registration_existing_email(self):
        data = {'username': 'unique_username', 'email': self.test_user_email, 'password': 'Password123'}
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_user_login_success(self):
        tokens = self._get_tokens_for_user(self.test_user_username, self.test_user_password)
        self.assertIn('access', tokens)

    def test_user_login_invalid_password(self):
        response = self.client.post(self.login_url, {'username': self.test_user_username, 'password': 'WrongPassword'})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_token_refresh_success(self):
        tokens = self._get_tokens_for_user(self.test_user_username, self.test_user_password)
        response = self.client.post(self.refresh_url, {'refresh': tokens['refresh']})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)

    def test_profile_update_success(self):
        tokens = self._get_tokens_for_user(self.test_user_username, self.test_user_password)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {tokens["access"]}')
        update_data = {'email': 'updated_profile@example.com', 'first_name': 'UpdatedFirst', 'last_name': 'UpdatedLast'}
        response = self.client.patch(self.profile_update_url, update_data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, 'updated_profile@example.com')
        self.user.email = self.test_user_email # reset for other tests
        self.user.save()


    def test_profile_update_unauthenticated(self):
        response = self.client.patch(self.profile_update_url, {'email': 'any@example.com'})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_password_reset_request_existing_email(self):
        response = self.client.post(self.password_reset_request_url, {'email': self.test_user_email})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('uidb64', response.data)

    def test_password_reset_confirm_success(self):
        reset_req = self.client.post(self.password_reset_request_url, {'email': self.test_user_email})
        uidb64 = reset_req.data['uidb64']
        token = reset_req.data['token']
        new_password = 'NewSecurePassword123'
        confirm_data = {'uidb64': uidb64, 'token': token, 'new_password': new_password, 'confirm_password': new_password}
        response = self.client.post(self.password_reset_confirm_url, confirm_data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(new_password))
        self.user.set_password(self.test_user_password) # reset for other tests
        self.user.save()

    def test_password_reset_confirm_invalid_token(self):
        uidb64 = urlsafe_base64_encode(force_bytes(self.user.pk))
        confirm_data = {'uidb64': uidb64, 'token': 'invalid-token', 'new_password': 'pw', 'confirm_password': 'pw'}
        response = self.client.post(self.password_reset_confirm_url, confirm_data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# --- Data Model Tests ---
class DataModelTests(DjangoTestCase): # Using DjangoTestCase for model-focused tests

    @classmethod
    def setUpTestData(cls):
        cls.prof1 = Professor.objects.create(name="Dr. Test Professor", email="prof.test@example.com", title="Professor", department="CS")
        cls.prof2 = Professor.objects.create(name="Dr. Jane Doe", email="jane.doe@example.com", title="Associate Professor")
        cls.user_for_message = User.objects.create_user(username="msguser", password="msgpassword")

    def test_create_professor(self):
        prof = Professor.objects.create(name="Dr. Smith", email="smith@example.com", title="Lecturer", department="Physics", bio="Loves physics.")
        self.assertEqual(prof.name, "Dr. Smith")
        self.assertEqual(prof.bio, "Loves physics.")

    def test_professor_str_method(self):
        self.assertEqual(str(self.prof1), "Dr. Test Professor")

    def test_professor_email_uniqueness_and_nulls(self):
        # Test two professors can have null email (if email is not set as required)
        Professor.objects.create(name="Prof No Email 1", email=None)
        Professor.objects.create(name="Prof No Email 2", email=None) # Should not raise error
        
        # Test two professors cannot have the same non-null email
        with self.assertRaises(IntegrityError):
            Professor.objects.create(name="Another Prof", email="prof.test@example.com") # Duplicate from setUpTestData

    def test_create_course(self):
        course = Course.objects.create(title="Intro to Testing", course_code="TEST101", description="Learn testing.", credits=3, department="QA")
        self.assertEqual(course.title, "Intro to Testing")
        self.assertEqual(course.credits, 3)

    def test_course_str_method(self):
        course = Course.objects.create(title="Advanced Testing", course_code="TEST501")
        self.assertEqual(str(course), "TEST501 - Advanced Testing")

    def test_course_code_uniqueness(self):
        Course.objects.create(title="Unique Course", course_code="UNIQUE101")
        with self.assertRaises(IntegrityError):
            Course.objects.create(title="Another Unique Course", course_code="UNIQUE101")

    def test_course_professor_many_to_many(self):
        course = Course.objects.create(title="Interdisciplinary Studies", course_code="MULTI101")
        course.professors.add(self.prof1, self.prof2)
        self.assertEqual(course.professors.count(), 2)
        self.assertIn(self.prof1, course.professors.all())
        self.assertIn(course, self.prof1.courses.all()) # Check related_name

    def test_course_professor_link_direct_creation_uniqueness(self):
        """Tests that directly creating a duplicate CourseProfessorLink raises IntegrityError."""
        course = Course.objects.create(title="Special Topics Direct", course_code="SPEC100D")
        CourseProfessorLink.objects.create(course=course, professor=self.prof1)
        with self.assertRaises(IntegrityError):
            CourseProfessorLink.objects.create(course=course, professor=self.prof1)

    def test_course_professor_add_idempotency(self):
        """Tests that Model.many_to_many.add() is idempotent."""
        course = Course.objects.create(title="Special Topics Add", course_code="SPEC100A")
        # Add the professor multiple times
        course.professors.add(self.prof1)
        course.professors.add(self.prof1)
        # Check that only one link exists in the database
        self.assertEqual(CourseProfessorLink.objects.filter(course=course, professor=self.prof1).count(), 1)
        # Check that the ORM also reports only one professor
        self.assertEqual(course.professors.count(), 1)


    def test_create_message(self):
        msg = Message.objects.create(user=self.user_for_message, content="Hello AI", role="user")
        self.assertEqual(msg.content, "Hello AI")
        self.assertEqual(msg.role, "user")
        self.assertIsInstance(msg.session_id, uuid.UUID)

    def test_message_str_method(self):
        msg = Message.objects.create(user=self.user_for_message, content="Test message content.", role="user")
        expected_str_start = f"{self.user_for_message.username} (user at "
        self.assertTrue(str(msg).startswith(expected_str_start))
        self.assertTrue(msg.content[:50] in str(msg))


    def test_message_ordering(self):
        session_uuid = uuid.uuid4()
        msg1 = Message.objects.create(user=self.user_for_message, session_id=session_uuid, content="First", role="user")
        # Manually adjust timestamp for testing if auto_now_add is too fast
        msg1.timestamp = msg1.timestamp.replace(microsecond=msg1.timestamp.microsecond - 100) 
        msg1.save()
        msg2 = Message.objects.create(user=self.user_for_message, session_id=session_uuid, content="Second", role="assistant")
        
        messages = Message.objects.filter(session_id=session_uuid)
        self.assertEqual(messages.first().content, "First")
        self.assertEqual(messages.last().content, "Second")

    def test_message_role_choices(self):
        # This is typically enforced by Django's model validation at form/serializer level
        # Direct creation might bypass some validation if not careful, but choices are for forms/serializers
        msg = Message.objects.create(user=self.user_for_message, content="Role test", role="user")
        self.assertEqual(msg.role, "user")
        # Attempting to create with an invalid role would typically raise an error at a higher level (e.g. serializer)
        # or a DataError at DB level if the choices are strictly enforced there.
        # For this test, we assume the choices are primarily for application-level validation.


# --- MessageView Tests ---
@patch.dict(os.environ, {"OPENAI_API_KEY": "test_api_key_value"}) # Ensure key is set for all tests in this class
class MessageViewTests(APITestCase):

    @classmethod
    def setUpTestData(cls):
        cls.chat_user = User.objects.create_user(username="chatuser", password="chatpassword")
        cls.chat_url = reverse('api:ai-chat')
        
        # Create test course data
        cls.test_course = Course.objects.create(
            code="CSI2132",
            title="Database Systems I",
            description="Introduction to database systems and SQL.",
            units=3.0,
            prerequisites="CSI2120",
            department="Computer Science"
        )
        
        # Create test professor
        cls.test_prof = Professor.objects.create(
            name="Dr. Jane Smith",
            title="Associate Professor",
            department="Computer Science",
            email="jane.smith@uottawa.ca"
        )
        
        # Link professor to course
        cls.test_course.professors.add(cls.test_prof)
        
        # Create test term
        cls.test_term = Term.objects.create(
            name="Fall 2024",
            term_code="2249",
            season="Fall"
        )
        
        # Create test offering
        CourseOffering.objects.create(
            course=cls.test_course,
            term=cls.test_term,
            section="A00",
            instructor="Dr. Jane Smith",
            schedule="Mon/Wed 10:00-11:30",
            location="SITE 0101"
        )

    def setUp(self):
        self.client = self.client_class()
        self.client.force_authenticate(user=self.chat_user)
        self.mock_openai_client = MagicMock()
        self.mock_chat_completions_create = self.mock_openai_client.chat.completions.create
        
        mock_ai_response = MagicMock()
        mock_ai_response.choices = [MagicMock()]
        mock_ai_response.choices[0].message = MagicMock()
        mock_ai_response.choices[0].message.content = "Mocked AI response content."
        self.mock_chat_completions_create.return_value = mock_ai_response

    @patch('api.views.openai.OpenAI')
    def test_course_code_detection(self, MockOpenAI):
        """Test that course codes are properly detected in messages"""
        MockOpenAI.return_value = self.mock_openai_client
        
        # Test with a message containing a course code
        response = self.client.post(self.chat_url, {
            'message': 'Can you tell me about CSI2132?'
        })
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Verify that the system prompt included course information
        _args, kwargs = self.mock_chat_completions_create.call_args
        system_message = kwargs['messages'][0]['content']
        self.assertIn("CSI2132", system_message)
        self.assertIn("Database Systems I", system_message)
        self.assertIn("Dr. Jane Smith", system_message)

    @patch('api.views.openai.OpenAI')
    def test_course_code_with_spaces(self, MockOpenAI):
        """Test that course codes with spaces are properly detected"""
        MockOpenAI.return_value = self.mock_openai_client
        
        response = self.client.post(self.chat_url, {
            'message': 'What is CSI 2132 about?'
        })
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        _args, kwargs = self.mock_chat_completions_create.call_args
        system_message = kwargs['messages'][0]['content']
        self.assertIn("CSI2132", system_message)

    @patch('api.views.openai.OpenAI')
    def test_nonexistent_course(self, MockOpenAI):
        """Test handling of nonexistent course codes"""
        MockOpenAI.return_value = self.mock_openai_client
        
        response = self.client.post(self.chat_url, {
            'message': 'Tell me about XYZ9999'
        })
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        _args, kwargs = self.mock_chat_completions_create.call_args
        system_message = kwargs['messages'][0]['content']
        # Should use default system prompt since course doesn't exist
        self.assertNotIn("XYZ9999", system_message)
        self.assertIn("Kairo, a friendly, knowledgeable", system_message)

    @patch('api.views.openai.OpenAI')
    def test_course_with_professor_info(self, MockOpenAI):
        """Test that professor information is included in course context"""
        MockOpenAI.return_value = self.mock_openai_client
        
        response = self.client.post(self.chat_url, {
            'message': 'Who teaches CSI2132?'
        })
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        _args, kwargs = self.mock_chat_completions_create.call_args
        system_message = kwargs['messages'][0]['content']
        self.assertIn("Dr. Jane Smith", system_message)
        self.assertIn("Associate Professor", system_message)
        self.assertIn("Computer Science", system_message)

    @patch('api.views.openai.OpenAI')
    def test_course_with_offering_info(self, MockOpenAI):
        """Test that course offering information is included"""
        MockOpenAI.return_value = self.mock_openai_client
        
        response = self.client.post(self.chat_url, {
            'message': 'When is CSI2132 offered?'
        })
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        _args, kwargs = self.mock_chat_completions_create.call_args
        system_message = kwargs['messages'][0]['content']
        self.assertIn("Fall 2024", system_message)
        self.assertIn("Section A00", system_message)
        self.assertIn("SITE 0101", system_message)

    @patch('api.views.openai.OpenAI') 
    def test_send_new_message_no_session_id(self, MockOpenAI):
        MockOpenAI.return_value = self.mock_openai_client

        response = self.client.post(self.chat_url, {'message': 'Hello AI, new session!'})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['role'], 'assistant')
        self.assertIn('session_id', response.data)
        
        session_id = uuid.UUID(response.data['session_id'])
        self.assertTrue(Message.objects.filter(user=self.chat_user, session_id=session_id, role='user').exists())
        self.assertTrue(Message.objects.filter(user=self.chat_user, session_id=session_id, role='assistant').exists())
        
        self.mock_chat_completions_create.assert_called_once()
        _args, kwargs = self.mock_chat_completions_create.call_args
        self.assertEqual(kwargs['messages'][-1]['content'], 'Hello AI, new session!')


    @patch('api.views.openai.OpenAI')
    def test_send_message_with_existing_session_id(self, MockOpenAI):
        MockOpenAI.return_value = self.mock_openai_client
        
        existing_session_id = uuid.uuid4()
        Message.objects.create(user=self.chat_user, session_id=existing_session_id, content="Initial user message", role="user")
        Message.objects.create(user=self.chat_user, session_id=existing_session_id, content="Initial AI response", role="assistant")

        response = self.client.post(self.chat_url, {'message': 'Another message!', 'session_id': str(existing_session_id)})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['session_id'], str(existing_session_id))
        
        self.assertEqual(Message.objects.filter(user=self.chat_user, session_id=existing_session_id).count(), 4)
        self.mock_chat_completions_create.assert_called_once()
        _args, kwargs = self.mock_chat_completions_create.call_args
        self.assertTrue(len(kwargs['messages']) > 1)


    def test_send_message_unauthenticated(self):
        self.client.force_authenticate(user=None)
        response = self.client.post(self.chat_url, {'message': 'Test unauth'})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_send_message_invalid_data_no_message(self):
        response = self.client.post(self.chat_url, {'session_id': str(uuid.uuid4())})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('message', response.data)

    @patch.dict(os.environ, {"OPENAI_API_KEY": ""})
    def test_send_message_openai_key_not_set(self):
        response = self.client.post(self.chat_url, {'message': 'Test no API key'})
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn("AI service is currently unavailable", response.data['error'])

    @patch('api.views.openai.OpenAI')
    def test_send_message_openai_api_error(self, MockOpenAI):
        mock_instance = MagicMock()
        mock_instance.chat.completions.create.side_effect = openai.APIError(message="Test API Error", request=None, body=None)
        MockOpenAI.return_value = mock_instance
        
        response = self.client.post(self.chat_url, {'message': 'Test OpenAI API Error'})
        self.assertTrue(status.is_server_error(response.status_code) or response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE)


    def test_get_messages_valid_session_id(self):
        session_id = uuid.uuid4()
        Message.objects.create(user=self.chat_user, session_id=session_id, content="Msg 1 User", role="user")
        Message.objects.create(user=self.chat_user, session_id=session_id, content="Msg 1 AI", role="assistant")
        
        response = self.client.get(self.chat_url, {'session_id': str(session_id)})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        self.assertEqual(response.data[0]['content'], "Msg 1 User")

    def test_get_messages_different_user_session(self):
        other_user = User.objects.create_user(username="otherchatuser", password="password")
        session_id = uuid.uuid4()
        Message.objects.create(user=other_user, session_id=session_id, content="Other user's message", role="user")
        
        response = self.client.get(self.chat_url, {'session_id': str(session_id)})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_get_messages_invalid_session_id_format(self):
        response = self.client.get(self.chat_url, {'session_id': 'not-a-uuid'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Invalid session_id format", response.data['error'])

    def test_get_messages_no_session_id_param(self):
        response = self.client.get(self.chat_url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("session_id query parameter is required", response.data['error'])

    def test_get_messages_unauthenticated(self):
        self.client.force_authenticate(user=None)
        response = self.client.get(self.chat_url, {'session_id': str(uuid.uuid4())})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch('api.views.openai.OpenAI')
    def test_conversation_history_limit(self, MockOpenAI):
        """Test that conversation history is limited to MAX_HISTORY_MESSAGES pairs"""
        MockOpenAI.return_value = self.mock_openai_client
        
        session_id = uuid.uuid4()
        # Create more messages than the limit
        for i in range(MessageView.MAX_HISTORY_MESSAGES * 2 + 2):
            Message.objects.create(
                user=self.chat_user,
                session_id=session_id,
                content=f"Message {i}",
                role='user' if i % 2 == 0 else 'assistant'
            )
        
        response = self.client.post(self.chat_url, {
            'message': 'New message',
            'session_id': str(session_id)
        })
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        _args, kwargs = self.mock_chat_completions_create.call_args
        messages = kwargs['messages']
        
        # System message + MAX_HISTORY_MESSAGES pairs
        expected_count = 1 + (MessageView.MAX_HISTORY_MESSAGES * 2)
        self.assertEqual(len(messages), expected_count)

    @patch('api.views.openai.OpenAI')
    def test_session_reset(self, MockOpenAI):
        """Test that session resets when requested"""
        MockOpenAI.return_value = self.mock_openai_client
        
        # Create initial session
        session_id = uuid.uuid4()
        Message.objects.create(
            user=self.chat_user,
            session_id=session_id,
            content="Initial message",
            role='user'
        )
        
        # Request reset
        response = self.client.post(self.chat_url, {
            'message': 'reset chat history',
            'session_id': str(session_id)
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotEqual(response.data['session_id'], str(session_id))
        self.assertIn('Chat history has been cleared', response.data['message'])

    @patch('api.views.openai.OpenAI')
    def test_session_expiry(self, MockOpenAI):
        """Test that old sessions are cleaned up"""
        MockOpenAI.return_value = self.mock_openai_client
        
        # Create an old session
        old_session_id = uuid.uuid4()
        old_message = Message.objects.create(
            user=self.chat_user,
            session_id=old_session_id,
            content="Old message",
            role='user',
            timestamp=timezone.now() - timezone.timedelta(days=MessageView.SESSION_EXPIRY_DAYS + 1)
        )
        
        # Create a new session
        new_session_id = uuid.uuid4()
        new_message = Message.objects.create(
            user=self.chat_user,
            session_id=new_session_id,
            content="New message",
            role='user'
        )
        
        # Make a request to trigger cleanup
        response = self.client.post(self.chat_url, {
            'message': 'Test message',
            'session_id': str(new_session_id)
        })
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Check that old message is deleted but new one remains
        self.assertFalse(Message.objects.filter(id=old_message.id).exists())
        self.assertTrue(Message.objects.filter(id=new_message.id).exists())

    @patch('api.views.openai.OpenAI')
    def test_conversation_history_order(self, MockOpenAI):
        """Test that conversation history maintains correct order"""
        MockOpenAI.return_value = self.mock_openai_client
        
        session_id = uuid.uuid4()
        messages = [
            ("First message", "user"),
            ("First response", "assistant"),
            ("Second message", "user"),
            ("Second response", "assistant")
        ]
        
        for content, role in messages:
            Message.objects.create(
                user=self.chat_user,
                session_id=session_id,
                content=content,
                role=role
            )
        
        response = self.client.post(self.chat_url, {
            'message': 'New message',
            'session_id': str(session_id)
        })
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        _args, kwargs = self.mock_chat_completions_create.call_args
        messages = kwargs['messages']
        
        # Skip system message
        conversation = messages[1:]
        
        # Verify order
        self.assertEqual(conversation[0]['content'], "First message")
        self.assertEqual(conversation[1]['content'], "First response")
        self.assertEqual(conversation[2]['content'], "Second message")
        self.assertEqual(conversation[3]['content'], "Second response")

    @patch('api.views.openai.OpenAI')
    def test_rmp_link_explicit_request(self, MockOpenAI):
        """Test that RMP link is included only for explicit rating requests"""
        MockOpenAI.return_value = self.mock_openai_client
        
        # Test explicit rating request
        response = self.client.post(self.chat_url, {
            'message': 'What is Prof. John Smith\'s rating on RateMyProfessors?'
        })
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('RateMyProfessors', response.data['content'])
        self.assertIn('John+Smith+uOttawa', response.data['content'])

    @patch('api.views.openai.OpenAI')
    def test_rmp_link_general_question(self, MockOpenAI):
        """Test that RMP link is not included for general professor questions"""
        MockOpenAI.return_value = self.mock_openai_client
        
        # Test general professor question
        response = self.client.post(self.chat_url, {
            'message': 'Who teaches CSI2132?'
        })
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotIn('RateMyProfessors', response.data['content'])

    @patch('api.views.openai.OpenAI')
    def test_rmp_link_various_requests(self, MockOpenAI):
        """Test RMP link inclusion for various types of requests"""
        MockOpenAI.return_value = self.mock_openai_client
        
        test_cases = [
            # (message, should_include_rmp)
            ("Show me reviews for Dr. Jane Smith", True),
            ("How is Prof. John Smith rated?", True),
            ("What are the ratings for Dr. Smith?", True),
            ("Who's the best professor for CSI2132?", False),
            ("Which professor should I take for ITI1120?", False),
            ("Tell me about Prof. Smith's teaching style", False),
            ("What's Prof. Smith's rating on RMP?", True),
            ("Can you tell me about Prof. Smith's reviews?", True),
            ("Who teaches database systems?", False),
            ("Is Prof. Smith a good professor?", False)
        ]
        
        for message, should_include_rmp in test_cases:
            response = self.client.post(self.chat_url, {'message': message})
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)
            
            if should_include_rmp:
                self.assertIn('RateMyProfessors', response.data['content'], 
                    f"RMP link should be included for: {message}")
            else:
                self.assertNotIn('RateMyProfessors', response.data['content'],
                    f"RMP link should not be included for: {message}")

    @patch('api.views.openai.OpenAI')
    def test_rmp_link_url_encoding(self, MockOpenAI):
        """Test that professor names are properly URL encoded in RMP links"""
        MockOpenAI.return_value = self.mock_openai_client
        
        # Test with a name containing spaces and special characters
        response = self.client.post(self.chat_url, {
            'message': 'What is Prof. Jean-Pierre Smith\'s rating?'
        })
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('Jean-Pierre+Smith+uOttawa', response.data['content'])
        self.assertNotIn('Jean-Pierre Smith uOttawa', response.data['content'])  # Should be encoded

    @patch('api.views.openai.OpenAI')
    def test_conversation_context_inclusion(self, MockOpenAI):
        """Test that conversation context is properly included in system prompt"""
        MockOpenAI.return_value = self.mock_openai_client
        
        session_id = uuid.uuid4()
        # Create a conversation history
        messages = [
            ("Who teaches CSI2132?", "user"),
            ("CSI2132 is taught by Dr. Jane Smith.", "assistant"),
            ("What's her rating?", "user"),
            ("I can help you find Dr. Jane Smith's ratings.", "assistant")
        ]
        
        for content, role in messages:
            Message.objects.create(
                user=self.chat_user,
                session_id=session_id,
                content=content,
                role=role
            )
        
        response = self.client.post(self.chat_url, {
            'message': 'Show me',
            'session_id': str(session_id)
        })
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        _args, kwargs = self.mock_chat_completions_create.call_args
        system_message = kwargs['messages'][0]['content']
        
        # Verify context is included
        self.assertIn("IMPORTANT CONVERSATION GUIDELINES", system_message)
        self.assertIn("User's last question", system_message)
        self.assertIn("Your last response", system_message)
        self.assertIn("What's her rating?", system_message)  # Last user message
        self.assertIn("I can help you find Dr. Jane Smith's ratings", system_message)  # Last AI message

    @patch('api.views.openai.OpenAI')
    def test_minimum_context_messages(self, MockOpenAI):
        """Test that at least MIN_CONTEXT_MESSAGES pairs are included"""
        MockOpenAI.return_value = self.mock_openai_client
        
        session_id = uuid.uuid4()
        # Create more than MIN_CONTEXT_MESSAGES pairs
        for i in range(MessageView.MIN_CONTEXT_MESSAGES * 2 + 2):
            Message.objects.create(
                user=self.chat_user,
                session_id=session_id,
                content=f"Message {i}",
                role='user' if i % 2 == 0 else 'assistant'
            )
        
        response = self.client.post(self.chat_url, {
            'message': 'New message',
            'session_id': str(session_id)
        })
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        _args, kwargs = self.mock_chat_completions_create.call_args
        messages = kwargs['messages']
        
        # System message + MIN_CONTEXT_MESSAGES pairs
        expected_count = 1 + (MessageView.MIN_CONTEXT_MESSAGES * 2)
        self.assertEqual(len(messages), expected_count)

    @patch('api.views.openai.OpenAI')
    def test_course_context_with_conversation(self, MockOpenAI):
        """Test that course context is properly combined with conversation context"""
        MockOpenAI.return_value = self.mock_openai_client
        
        session_id = uuid.uuid4()
        # Create a conversation about a course
        messages = [
            ("Tell me about CSI2132", "user"),
            ("CSI2132 is Database Systems I.", "assistant"),
            ("Who teaches it?", "user"),
            ("It's taught by Dr. Jane Smith.", "assistant")
        ]
        
        for content, role in messages:
            Message.objects.create(
                user=self.chat_user,
                session_id=session_id,
                content=content,
                role=role
            )
        
        response = self.client.post(self.chat_url, {
            'message': 'What are the prerequisites?',
            'session_id': str(session_id)
        })
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        _args, kwargs = self.mock_chat_completions_create.call_args
        system_message = kwargs['messages'][0]['content']
        
        # Verify both course and conversation context
        self.assertIn("CURRENT COURSE CONTEXT", system_message)
        self.assertIn("CSI2132", system_message)
        self.assertIn("RECENT CONVERSATION CONTEXT", system_message)
        self.assertIn("Who teaches it?", system_message)
        self.assertIn("It's taught by Dr. Jane Smith", system_message)

    @patch('api.views.openai.OpenAI')
    def test_short_message_context(self, MockOpenAI):
        """Test that short messages are treated as follow-ups"""
        MockOpenAI.return_value = self.mock_openai_client
        
        session_id = uuid.uuid4()
        # Create a conversation with short follow-up
        messages = [
            ("Who teaches CSI2132?", "user"),
            ("CSI2132 is taught by Dr. Jane Smith.", "assistant"),
            ("What about her?", "user"),  # Short follow-up
            ("Dr. Jane Smith is an Associate Professor.", "assistant"),
            ("And ratings?", "user")  # Another short follow-up
        ]
        
        for content, role in messages:
            Message.objects.create(
                user=self.chat_user,
                session_id=session_id,
                content=content,
                role=role
            )
        
        response = self.client.post(self.chat_url, {
            'message': 'Show me',
            'session_id': str(session_id)
        })
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        _args, kwargs = self.mock_chat_completions_create.call_args
        system_message = kwargs['messages'][0]['content']
        
        # Verify context includes guidance about short messages
        self.assertIn("For short user replies", system_message)
        self.assertIn("treat them as follow-ups", system_message)
        self.assertIn("And ratings?", system_message)  # Last user message
        self.assertIn("Dr. Jane Smith is an Associate Professor", system_message)  # Last AI message


# --- populate_data command Tests ---
from django.core.management import call_command
# Re-import TestCase if it's not already imported as DjangoTestCase, or use DjangoTestCase
# from django.test import TestCase # Already imported as DjangoTestCase
from .models import Professor, Course, Term, CourseOffering # Already imported some

class PopulateDataCommandTests(DjangoTestCase): # Use DjangoTestCase as per existing style
    """
    Tests for the populate_data management command.
    Ensures data from professors.json, courses.json, and all_courses_by_term.json
    is correctly populated into the database.
    """

    @classmethod
    def setUpTestData(cls):
        # It's good practice to ensure a clean slate, but TestCase does this.
        # We can use this to set up any data that the command might rely on *if* it wasn't creating everything.
        # For this command, it creates all its data, so this might be minimal.
        # However, the mock JSON files are the primary source of data.
        pass

    def test_populate_data_command_full_run(self):
        """
        Tests a full run of the populate_data command, checking creation and linking of objects.
        """
        # Ensure data directory and files are set up by previous steps or here (if not done globally)
        # For this test, we assume the JSON files (professors.json, courses.json, all_courses_by_term.json)
        # are in api/data/ as per the command's expectation.

        call_command('populate_data')

        # Assert Term Creation
        # Based on all_courses_by_term.json: "Fall 2024" and "Winter 2025"
        self.assertEqual(Term.objects.count(), 2, "Should create 2 terms.")
        try:
            fall_term = Term.objects.get(name="Fall 2024")
            winter_term = Term.objects.get(name="Winter 2025")
        except Term.DoesNotExist:
            self.fail("Required terms 'Fall 2024' or 'Winter 2025' were not created.")

        # The populate_data command's term parsing logic for term_code and season:
        # "Fall 2024" -> name="Fall 2024", term_code="UNKNOWN", season="Fall" (if not in "Name (Code)" format)
        # "Winter 2025" -> name="Winter 2025", term_code="UNKNOWN", season="Winter"
        # If the term name in JSON was "Fall 2024 (2249)", then term_code="2249", season="Fall"
        # The provided all_courses_by_term.json uses "Fall 2024" as key.
        # Updated logic in populate_data.py creates term_code like "FALL_2024".
        self.assertEqual(fall_term.term_code, "FALL_2024", "Fall term code should be FALL_2024.")
        self.assertEqual(fall_term.season.lower(), "fall", "Fall term season should be Fall.") # Lower for case-insensitivity
        self.assertEqual(winter_term.term_code, "WINTER_2025", "Winter term code should be WINTER_2025.")
        self.assertEqual(winter_term.season.lower(), "winter", "Winter term season should be Winter.")


        # Assert Professor Creation
        # Based on professors.json: Dr. Turing, Dr. Lovelace, Dr. Newton, Dr. Einstein
        self.assertEqual(Professor.objects.count(), 4, "Should create 4 professors.")
        try:
            prof_turing = Professor.objects.get(email="turing@example.com")
            self.assertEqual(prof_turing.name, "Dr. Turing")
        except Professor.DoesNotExist:
            self.fail("Professor Dr. Turing not found.")

        # Assert Course Creation/Update
        # courses.json defines 4 courses: CS101, MA201, CS202, PH101
        # all_courses_by_term.json also implies these courses.
        # The command uses get_or_create, so they should resolve to 4 unique courses.
        self.assertEqual(Course.objects.count(), 4, "Should have 4 unique courses.")
        try:
            cs101 = Course.objects.get(course_code="CS101")
            # Actual title is "Introduction to Computer Science" from courses.json
            # The test was incorrectly expecting "Intro to Computer Science"
            self.assertEqual(cs101.title, "Introduction to Computer Science", "CS101 title should be from courses.json")
            # The populate_data command updates title from all_courses_by_term if existing is empty.
            # courses.json provides "Introduction to Computer Science"
            # all_courses_by_term.json provides "Intro to Computer Science"
            # The behavior depends on which file is processed first for a given course or if titles are updated.
            # The _load_term_course_offerings part might update it.
            # Let's assume the `_load_courses` runs first, then `_load_term_course_offerings`.
            # If `_load_courses` sets "Introduction to Computer Science", and `_load_term_course_offerings`
            # sees a non-empty title, it might not update it.
            # For this test, we'll check against the version from `all_courses_by_term.json` as it's more specific to offerings.
            # However, current logic in populate_data for course title update:
            # `elif course_obj.title != course_title and course_title: if not course_obj.title: course_obj.title = course_title`
            # This means it only updates if the *existing* title is empty.
            # So, if courses.json populates it first, it will be "Introduction to Computer Science".
            # The test was expecting "Intro to Computer Science", which is from all_courses_by_term.json.
            # Correct expectation is "Introduction to Computer Science" from courses.json.
            self.assertEqual(cs101.title, "Introduction to Computer Science", "DEBUG: CS101 title should be from courses.json")


        except Course.DoesNotExist:
            self.fail("Course CS101 not found.")

        # Assert CourseOffering Creation
        # Based on all_courses_by_term.json: 3 for Fall 2024, 2 for Winter 2025 = 5 offerings
        self.assertEqual(CourseOffering.objects.count(), 5, "Should create 5 course offerings.")
        
        try:
            offering_cs101_a01 = CourseOffering.objects.get(
                course__course_code="CS101", 
                section="A01", 
                term__name="Fall 2024"
            )
            self.assertEqual(offering_cs101_a01.instructor, "Dr. Turing")
            self.assertEqual(offering_cs101_a01.schedule, "Mon/Wed/Fri 10:00-10:50")
            self.assertEqual(offering_cs101_a01.location, "STEM Hall 101")
            self.assertEqual(offering_cs101_a01.course, cs101)
            self.assertEqual(offering_cs101_a01.term, fall_term)
        except CourseOffering.DoesNotExist:
            self.fail("CourseOffering CS101-A01 for Fall 2024 not found.")

        # Assert Linking (Course-Professor from courses.json)
        cs101_course = Course.objects.get(course_code="CS101")
        # professors.json defines Dr. Turing. courses.json links CS101 to turing@example.com.
        # The _load_courses method should handle this association.
        self.assertEqual(cs101_course.professors.count(), 1, "CS101 should have 1 professor from courses.json.")
        self.assertEqual(cs101_course.professors.first().name, "Dr. Turing")


    def test_populate_data_idempotency(self):
        """
        Tests that running the populate_data command multiple times is idempotent.
        """
        call_command('populate_data') # First run

        counts_after_first_run = {
            'professor': Professor.objects.count(),
            'course': Course.objects.count(),
            'term': Term.objects.count(),
            'course_offering': CourseOffering.objects.count(),
        }
        
        # Store attributes of a specific object to check for unwanted changes
        try:
            offering_before_rerun = CourseOffering.objects.get(
                course__course_code="CS101", section="A01", term__name="Fall 2024"
            )
            offering_instructor_before = offering_before_rerun.instructor
        except CourseOffering.DoesNotExist:
            self.fail("Failed to fetch specific CourseOffering for idempotency check before re-run.")


        call_command('populate_data') # Second run

        self.assertEqual(Professor.objects.count(), counts_after_first_run['professor'], "Professor count changed after second run.")
        self.assertEqual(Course.objects.count(), counts_after_first_run['course'], "Course count changed after second run.")
        self.assertEqual(Term.objects.count(), counts_after_first_run['term'], "Term count changed after second run.")
        self.assertEqual(CourseOffering.objects.count(), counts_after_first_run['course_offering'], "CourseOffering count changed after second run.")

        # Check a specific object again
        try:
            offering_after_rerun = CourseOffering.objects.get(
                course__course_code="CS101", section="A01", term__name="Fall 2024"
            )
            self.assertEqual(offering_after_rerun.instructor, offering_instructor_before, "Instructor for specific offering changed after re-run.")
            # Add more attribute checks if necessary
        except CourseOffering.DoesNotExist:
            self.fail("Failed to fetch specific CourseOffering for idempotency check after re-run.")


# --- New Model Tests for ImportantDate and ExamEvent ---
class NewDataModelTests(DjangoTestCase):

    def test_create_important_date(self):
        important_date = ImportantDate.objects.create(
            title="Enrollment Deadline",
            description="Last day to enroll for Fall semester.",
            category="enrollment",
            start_date=date(2024, 8, 15),
            end_date=date(2024, 8, 15),
            link="http://example.com/enroll"
        )
        self.assertEqual(important_date.title, "Enrollment Deadline")
        self.assertEqual(important_date.category, "enrollment")
        self.assertEqual(str(important_date), "Enrollment Deadline")

    def test_important_date_ordering(self):
        ImportantDate.objects.create(title="Holiday A", start_date=date(2024, 12, 25), category="holiday", description="Desc A")
        ImportantDate.objects.create(title="Holiday B", start_date=date(2024, 7, 4), category="holiday", description="Desc B")
        dates = ImportantDate.objects.all()
        self.assertEqual(dates.first().title, "Holiday B") # July 4th should come before Dec 25th

    def test_create_exam_event(self):
        exam = ExamEvent.objects.create(
            course_code="CS101",
            title="Final Exam",
            description="Comprehensive final exam.",
            date=date(2024, 12, 10),
            start_time=time(9, 0, 0),
            end_time=time(12, 0, 0),
            location="Main Hall Room 101",
            is_deferred=False
        )
        self.assertEqual(exam.course_code, "CS101")
        self.assertEqual(exam.title, "Final Exam")
        self.assertFalse(exam.is_deferred)
        self.assertEqual(str(exam), f"CS101 - Final Exam on {date(2024, 12, 10)}")

    def test_exam_event_ordering(self):
        ExamEvent.objects.create(course_code="MA202", title="Midterm", date=date(2024, 10, 15), start_time=time(10,0), end_time=time(11,0), location="Room A", description="Midterm")
        ExamEvent.objects.create(course_code="PH101", title="Final", date=date(2024, 12, 5), start_time=time(14,0), end_time=time(16,0), location="Room B", description="Final")
        exams = ExamEvent.objects.all()
        self.assertEqual(exams.first().course_code, "MA202") # Oct 15 before Dec 5


# --- New Serializer Tests for ImportantDate and ExamEvent ---
class NewSerializerTests(APITestCase): # Using APITestCase for consistency, though DjangoTestCase might also work

    @classmethod
    def setUpTestData(cls):
        cls.important_date_data = {
            "title": "Test Holiday",
            "description": "A day off.",
            "category": "holiday",
            "start_date": "2024-07-04",
            "end_date": "2024-07-04",
            "link": "http://example.com/holiday"
        }
        cls.important_date_obj = ImportantDate.objects.create(
            title="Test Holiday", description="A day off.", category="holiday",
            start_date=date(2024,7,4), end_date=date(2024,7,4), link="http://example.com/holiday"
        )

        cls.exam_event_data = {
            "course_code": "EXAM101",
            "title": "Test Exam",
            "description": "Comprehensive test.",
            "date": "2024-12-15",
            "start_time": "09:00:00",
            "end_time": "11:00:00",
            "location": "Room 101",
            "is_deferred": False
        }
        cls.exam_event_obj = ExamEvent.objects.create(
            course_code="EXAM101", title="Test Exam", description="Comprehensive test.",
            date=date(2024,12,15), start_time=time(9,0), end_time=time(11,0),
            location="Room 101", is_deferred=False
        )

    def test_important_date_serializer_valid(self):
        serializer = ImportantDateSerializer(instance=self.important_date_obj)
        data = serializer.data
        self.assertEqual(data['title'], self.important_date_obj.title)
        self.assertEqual(data['category'], self.important_date_obj.category)
        self.assertEqual(data['start_date'], "2024-07-04")

    def test_important_date_deserializer_valid(self):
        serializer = ImportantDateSerializer(data=self.important_date_data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        important_date = serializer.save()
        self.assertEqual(important_date.title, self.important_date_data['title'])

    def test_important_date_deserializer_invalid(self):
        invalid_data = self.important_date_data.copy()
        invalid_data['start_date'] = "invalid-date" # Invalid date format
        serializer = ImportantDateSerializer(data=invalid_data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('start_date', serializer.errors)

    def test_exam_event_serializer_valid(self):
        serializer = ExamEventSerializer(instance=self.exam_event_obj)
        data = serializer.data
        self.assertEqual(data['course_code'], self.exam_event_obj.course_code)
        self.assertEqual(data['title'], self.exam_event_obj.title)
        self.assertEqual(data['date'], "2024-12-15")
        self.assertEqual(data['start_time'], "09:00:00")

    def test_exam_event_deserializer_valid(self):
        serializer = ExamEventSerializer(data=self.exam_event_data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        exam_event = serializer.save()
        self.assertEqual(exam_event.course_code, self.exam_event_data['course_code'])

    def test_exam_event_deserializer_invalid(self):
        invalid_data = self.exam_event_data.copy()
        invalid_data['date'] = "not-a-date"
        serializer = ExamEventSerializer(data=invalid_data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('date', serializer.errors)


# --- New ViewSet Tests ---
class BaseViewSetTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username='testapiviewuser', password='StrongPassword123')

    def setUp(self):
        self.client = self.client_class()
        self.client.force_authenticate(user=self.user)


class ImportantDateViewSetTests(BaseViewSetTests):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.date1 = ImportantDate.objects.create(title="Holiday 1", category="holiday", start_date=date(2024,1,1), description="New Year")
        cls.date2 = ImportantDate.objects.create(title="Enrollment Deadline", category="enrollment", start_date=date(2024,8,1), description="Fall Enroll")
        cls.list_create_url = reverse('api:importantdate-list') # Basename is 'importantdate'
        cls.detail_url = lambda pk: reverse('api:importantdate-detail', kwargs={'pk': pk})


    def test_list_important_dates(self):
        response = self.client.get(self.list_create_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_retrieve_important_date(self):
        response = self.client.get(self.detail_url(self.date1.pk))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], self.date1.title)

    def test_create_important_date_valid(self):
        data = {"title": "New Event", "category": "other", "start_date": "2024-10-10", "description": "A new event"}
        response = self.client.post(self.list_create_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(ImportantDate.objects.count(), 3)

    def test_create_important_date_invalid(self):
        data = {"title": "Invalid Event", "category": "other"} # Missing start_date
        response = self.client.post(self.list_create_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_update_important_date(self):
        data = {"title": "Updated Holiday 1", "category": "holiday", "start_date": "2024-01-01", "description":"Updated Desc"}
        response = self.client.put(self.detail_url(self.date1.pk), data)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.date1.refresh_from_db()
        self.assertEqual(self.date1.title, "Updated Holiday 1")

    def test_delete_important_date(self):
        response = self.client.delete(self.detail_url(self.date1.pk))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(ImportantDate.objects.count(), 1)

    def test_filter_important_date_by_category(self):
        response = self.client.get(self.list_create_url, {'category': 'holiday'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['title'], "Holiday 1")

    def test_filter_important_date_by_start_date_gte(self):
        response = self.client.get(self.list_create_url, {'start_date_after': '2024-07-01'}) # Using DateFromToRangeFilter field name
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['title'], "Enrollment Deadline")

    def test_search_important_date(self):
        response = self.client.get(self.list_create_url, {'search': 'Enroll'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['title'], "Enrollment Deadline")


class ExamEventViewSetTests(BaseViewSetTests):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.exam1 = ExamEvent.objects.create(course_code="CS101", title="Final", date=date(2024,12,10), start_time=time(9,0), end_time=time(12,0), location="Hall A", description="CS Final")
        cls.exam2 = ExamEvent.objects.create(course_code="MA202", title="Midterm", date=date(2024,10,20), start_time=time(14,0), end_time=time(16,0), location="Hall B", description="MA Midterm", is_deferred=True)
        cls.list_create_url = reverse('api:examevent-list') # Basename is 'examevent'
        cls.detail_url = lambda pk: reverse('api:examevent-detail', kwargs={'pk': pk})

    def test_list_exam_events(self):
        response = self.client.get(self.list_create_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_retrieve_exam_event(self):
        response = self.client.get(self.detail_url(self.exam1.pk))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], self.exam1.title)

    def test_create_exam_event_valid(self):
        data = {"course_code": "PH201", "title": "Quiz 1", "date": "2024-09-15", "start_time": "10:00", "end_time": "10:50", "location": "Room C", "description":"Physics Quiz"}
        response = self.client.post(self.list_create_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(ExamEvent.objects.count(), 3)

    def test_filter_exam_by_course_code(self):
        response = self.client.get(self.list_create_url, {'course_code': 'CS101'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['title'], "Final")

    def test_filter_exam_by_is_deferred(self):
        response = self.client.get(self.list_create_url, {'is_deferred': 'true'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['course_code'], "MA202")

    def test_search_exam_event(self):
        response = self.client.get(self.list_create_url, {'search': 'Midterm'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['title'], "Midterm")
