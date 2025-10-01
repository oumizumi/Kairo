import json
from unittest.mock import patch

from django.test import TestCase, Client, override_settings


class AIRouterTests(TestCase):
    @override_settings(ROOT_URLCONF='kairo.urls')
    def setUp(self):
        self.client = Client()

    @patch('api.views_ai.cfg', side_effect=lambda k, d='': {'SCHEDULE_FEATURE_ENABLED': '0', 'SCHEDULE_COMING_SOON_MSG': 'Soon'}.get(k, d))
    def test_schedule_intent_disabled_returns_configured_message(self, _cfg):
        payload = {"q": "please build schedule for fall"}
        resp = self.client.post('/api/ai/router', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(resp.status_code, 200)
        body = json.loads(resp.content)
        self.assertEqual(body.get('intent'), 'build_schedule')
        self.assertEqual(body.get('status'), 'disabled')
        self.assertEqual(body.get('message'), 'Soon')

    @patch('api.views_ai.cfg', side_effect=lambda k, d='': {'AI_DAILY_LIMIT_ENABLED': '1', 'AI_DAILY_LIMIT_PER_USER': '2', 'AI_LIMIT_BLOCK_MSG': 'Blocked'}.get(k, d))
    @patch('api.views_ai.call_fast_llm', return_value='ok')
    def test_daily_limit_blocks_on_third_request(self, _fast, _cfg):
        payload = {"q": "hello"}
        for i in range(2):
            r = self.client.post('/api/ai/router', data=json.dumps(payload), content_type='application/json')
            self.assertEqual(r.status_code, 200)
        r3 = self.client.post('/api/ai/router', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(r3.status_code, 429)
        body = json.loads(r3.content)
        self.assertEqual(body.get('error'), 'limit_reached')
        self.assertEqual(body.get('message'), 'Blocked')

    @patch('api.views_ai.cfg', side_effect=lambda k, d='': d)
    @patch('api.views_ai.call_fast_llm', return_value='ok')
    def test_fast_qa_responds(self, _fast, _cfg):
        payload = {"q": "what is kairo"}
        r = self.client.post('/api/ai/router', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(r.status_code, 200)
        body = json.loads(r.content)
        self.assertIn('fast', body)






