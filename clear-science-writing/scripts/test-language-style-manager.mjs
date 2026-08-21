#!/usr/bin/env node

import http from "node:http";

const server = http.createServer((request, response) => {
  if (request.method !== "POST" || request.url !== "/api/language-style/validate") {
    response.writeHead(404).end();
    return;
  }
  const chunks = [];
  request.on("data", (chunk) => chunks.push(chunk));
  request.on("end", () => {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    const text = String(body.text || "");
    const violation = text === "没有。刚才只改了句子。"
      ? { ruleId: "PM-003", paragraph: 1, message: "简单问题包含额外说明。", evidence: "刚才只改了句子" }
      : text === "我会更新规则。"
      ? { ruleId: "PM-006", paragraph: 1, message: "执行说明包含多余第一人称。", evidence: "我会" }
      : undefined;
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({
      code: 0,
      data: {
        passed: !violation,
        violations: violation ? [violation] : []
      }
    }));
  });
});

server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  process.stdout.write(`http://127.0.0.1:${address.port}\n`);
});
