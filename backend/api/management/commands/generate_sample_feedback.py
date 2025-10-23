from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
import random
import uuid

from api.models import AIResponseFeedback, EmailFeedback


class Command(BaseCommand):
    help = 'Generate sample feedback data for testing'

    def add_arguments(self, parser):
        parser.add_argument(
            '--count',
            type=int,
            default=50,
            help='Number of feedback entries to create'
        )

    def handle(self, *args, **options):
        count = options['count']
        
        # Get or create a test user
        user, created = User.objects.get_or_create(
            username='feedback_test_user',
            defaults={
                'email': 'test@uottawa.ca',
                'first_name': 'Test',
                'last_name': 'User'
            }
        )
        
        if created:
            self.stdout.write(f'Created test user: {user.username}')

        # Sample data
        sample_user_inputs = [
            "I need help with my assignment deadline",
            "Can you explain the course prerequisites?",
            "How do I contact my professor?",
            "What are the office hours?",
            "I want to drop this course",
            "Can I get an extension for my project?",
            "When is the final exam?",
            "How do I access the course materials?",
            "I'm having trouble with the lab assignment",
            "Can you help me understand this concept?"
        ]
        
        sample_ai_responses = [
            "I can help you with assignment deadline questions. Please check your course syllabus for specific dates.",
            "Course prerequisites are listed in the course catalog. You can find them on uOzone.",
            "You can contact your professor via email or during their office hours.",
            "Office hours are typically listed on the course syllabus and uOzone.",
            "To drop a course, you need to do so through uOzone before the deadline.",
            "For extensions, you should contact your professor directly with your request.",
            "Final exam schedules are posted on the university website closer to exam period.",
            "Course materials are available through Brightspace or as specified by your professor.",
            "For lab assignments, I recommend attending lab sessions or contacting your TA.",
            "I'd be happy to help explain concepts. Could you be more specific about what you need help with?"
        ]
        
        sample_email_subjects = [
            "Request for Assignment Extension",
            "Question about Course Prerequisites",
            "Office Hours Meeting Request",
            "Clarification on Lab Assignment",
            "Course Drop Inquiry",
            "Final Exam Schedule Question",
            "Access to Course Materials",
            "Project Deadline Extension",
            "Concept Clarification Request",
            "Grade Inquiry"
        ]
        
        sample_email_bodies = [
            "Dear Professor,\n\nI hope this message finds you well. I am writing to request an extension for the upcoming assignment due to unforeseen circumstances.\n\nBest regards,\nStudent",
            "Dear Professor,\n\nI have a question about the prerequisites for this course. Could we schedule a time to discuss this?\n\nBest regards,\nStudent",
            "Dear Professor,\n\nI would like to schedule a meeting during your office hours to discuss my progress in the course.\n\nBest regards,\nStudent",
            "Dear Professor,\n\nI need some clarification on the lab assignment requirements. Could you please help?\n\nBest regards,\nStudent",
            "Dear Professor,\n\nI am considering dropping this course and would like to discuss the implications.\n\nBest regards,\nStudent"
        ]
        
        professor_names = [
            "Dr. Smith", "Prof. Johnson", "Dr. Williams", "Prof. Brown", "Dr. Davis",
            "Prof. Miller", "Dr. Wilson", "Prof. Moore", "Dr. Taylor", "Prof. Anderson"
        ]

        feedback_created = 0
        
        for i in range(count):
            # Random date within the last 30 days
            days_ago = random.randint(0, 30)
            created_at = timezone.now() - timedelta(days=days_ago)
            
            # Random feedback type
            feedback_type = random.choices(
                ['email', 'chat', 'schedule', 'other'],
                weights=[0.6, 0.3, 0.05, 0.05]
            )[0]
            
            # Random rating (weighted towards positive)
            rating = random.choices(
                [1, 2, 3, 4, 5],
                weights=[0.05, 0.1, 0.2, 0.35, 0.3]
            )[0]
            
            # Random user input and AI response
            user_input = random.choice(sample_user_inputs)
            ai_response = random.choice(sample_ai_responses)
            
            # Create feedback
            feedback = AIResponseFeedback.objects.create(
                user=user,
                feedback_type=feedback_type,
                user_input=user_input,
                ai_response=ai_response,
                rating=rating,
                feedback_text=self.generate_feedback_text(rating),
                is_helpful=rating >= 3,
                is_accurate=random.choice([True, True, True, False]),  # Mostly accurate
                is_professional=random.choice([True, True, True, True, False]),  # Mostly professional
                is_relevant=random.choice([True, True, True, False]),  # Mostly relevant
                model_used='gpt-4o-mini',
                prompt_version='v2.0',
                session_id=uuid.uuid4(),
                created_at=created_at,
                ip_address='127.0.0.1',
                user_agent='Mozilla/5.0 (Test Browser)'
            )
            
            # Create email-specific feedback if it's an email type
            if feedback_type == 'email':
                subject = random.choice(sample_email_subjects)
                body = random.choice(sample_email_bodies)
                professor = random.choice(professor_names)
                
                EmailFeedback.objects.create(
                    ai_feedback=feedback,
                    generated_subject=subject,
                    generated_body=body,
                    professor_name=professor,
                    professor_email=f"{professor.lower().replace(' ', '').replace('.', '')}@uottawa.ca",
                    subject_quality=random.randint(3, 5),
                    body_quality=random.randint(3, 5),
                    too_formal=random.choice([True, False, False, False]),
                    too_casual=random.choice([True, False, False, False, False]),
                    wrong_tone=random.choice([True, False, False, False, False]),
                    missing_context=random.choice([True, False, False, False]),
                    grammatical_errors=random.choice([True, False, False, False, False]),
                    user_modified_subject=random.choice([True, False, False]),
                    user_modified_body=random.choice([True, False]),
                )
            
            feedback_created += 1
            
            if feedback_created % 10 == 0:
                self.stdout.write(f'Created {feedback_created} feedback entries...')
        
        self.stdout.write(
            self.style.SUCCESS(f'Successfully created {feedback_created} feedback entries')
        )

    def generate_feedback_text(self, rating):
        """Generate realistic feedback text based on rating"""
        if rating >= 4:
            positive_feedback = [
                "Great response! Very helpful and accurate.",
                "Perfect email generation, saved me a lot of time.",
                "Exactly what I needed, professional and clear.",
                "AI understood my request perfectly.",
                "Excellent quality, would use again.",
                "Very impressed with the accuracy and tone.",
                "Helpful and well-structured response."
            ]
            return random.choice(positive_feedback)
        elif rating == 3:
            neutral_feedback = [
                "Good response but could be more specific.",
                "Helpful but needed some minor adjustments.",
                "Decent quality, mostly accurate.",
                "Good starting point but required editing.",
                "Acceptable response, met basic needs."
            ]
            return random.choice(neutral_feedback)
        else:
            negative_feedback = [
                "Response was too generic and not helpful.",
                "AI didn't understand my specific request.",
                "Email tone was inappropriate for the context.",
                "Missing important details I mentioned.",
                "Response was confusing and unclear.",
                "Not relevant to what I was asking.",
                "Poor quality, had to rewrite completely."
            ]
            return random.choice(negative_feedback)