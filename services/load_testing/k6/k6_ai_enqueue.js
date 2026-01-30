import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
	vus: 400,
	duration: '3m',
	thresholds: {
		'http_req_failed': ['rate<0.02'],
		'http_req_duration': ['p(95)<800'],
	},
};

export default function () {
	const base = __ENV.BASE_URL;
	const payload = JSON.stringify({ q: 'schedule help' });
	const res = http.post(`${base}/api/ai/enqueue`, payload, {
		headers: { 'Content-Type': 'application/json' },
		timeout: '5s',
	});
	check(res, { '202/200': (r) => r.status === 200 || r.status === 202 });
	sleep(2);
}











