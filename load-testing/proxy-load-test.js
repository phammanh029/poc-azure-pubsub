import http from "k6/http";
import { check, sleep } from "k6";

const tenantIds = [
  // this will be retrieved from the redis with `KEYS *` command
  "0199a3a6-9a65-7790-a81a-a63a5657249a",
  "0199a3af-1dda-75c3-adbc-cc1959ab22c4",
  "0199a3af-1dee-73cd-a492-8315a4184e33",
  "0199a3af-1deb-772e-9e77-1d16513c94aa",
  "0199a3af-1dee-747e-a0cf-8f6910f30a8d",
  "0199a3af-1e0e-740c-a720-3062fb3dd13e",
  "0199a3af-1dba-730a-aae4-099a4e77d7b9",
  "0199a3af-1db6-765f-9e95-9107e4214ab5",
  "0199a3af-1dc6-764a-ba0a-d066b614fbaf",
  "0199a3af-1dc5-73d9-b0ac-be93589fd94a",
];

export const options = {
  stages: [
    { duration: "30s", target: 25 },
    // { duration: "3m", target: 75 },
    // { duration: "2m", target: 120 },
    // { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<750"],
  },
};

export default function proxyLoadTest() {
  const tenant = tenantIds[(__VU + __ITER) % tenantIds.length];
  const res = http.get("http://localhost:3000/proxy", {
    headers: {
      "x-tenant-id": tenant,
    },
  });

  check(res, {
    "status is 200": (r) => r.status === 200,
  });

  sleep(0.25);
}
