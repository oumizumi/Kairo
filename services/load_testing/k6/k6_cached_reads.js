import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
	vus: 2000,
	duration: '3m',
	thresholds: {
		'http_req_failed': ['rate<0.01'],
		'http_req_duration': ['p(95)<800'],
	},
};

export default function () {
	const base = __ENV.BASE_URL;
	const url = `${base}/api/courses/?search=CSI`;
	const res = http.get(url, { timeout: '5s' });
	check(res, { '200': (r) => r.status === 200 });
	sleep(1 + Math.random());
}











