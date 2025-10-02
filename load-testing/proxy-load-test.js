import http from 'k6/http';
import { check, sleep } from 'k6';

const tenantIds = [
  // this will be retrieved from the redis with `KEYS *` command
  '0199a571-aa1b-77ee-832a-cc24571fb13e',
  '0199a576-7bc1-745b-8bf6-f6d8c62bdde0',
  '0199a576-8bf9-72d8-8c8d-c99a4315be97',
  '0199a576-8bfd-704b-a030-ae16ffd481e2',
  '0199a576-8c20-726f-b230-45579c4baa3e',
  '0199a576-7c18-7198-976e-941729ddafb0',
  '0199a576-7d15-7032-a046-2a6e9fcbf582',
  '0199a576-800f-77bc-a23f-d2728af50955',
  '0199a576-8054-7278-a05c-30ac64087d7c',
  '0199a576-8ba2-761f-a8f5-91b23ab1ef4e',
  '0199a576-8b73-71f8-b3d2-489c16945a22',
];

export const options = {
  stages: [
    { duration: '30s', target: 25 },
    { duration: "3m", target: 75 },
    { duration: "2m", target: 120 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<750'],
  },
};

export default function proxyLoadTest() {
  const tenant = tenantIds[(__VU + __ITER) % tenantIds.length];
  const res = http.get(
    'https://tunnel-server.happycoast-c9c536d1.germanywestcentral.azurecontainerapps.io/proxy',
    {
      headers: {
        'x-tenant-id': tenant,
      },
    }
  );

  check(res, {
    'status is 200': (r) => r.status === 200,
  });
  console.log(res);

  sleep(0.25);
}
