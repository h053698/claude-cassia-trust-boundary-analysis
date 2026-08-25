// vulnerable-server.js
// 취약 구현 (로컬 목업). 실제 결제망과 통신하지 않는다.
//
// 재현하는 결함:
//   결함 A: 클라이언트가 보낸 checkout_flow를 그대로 신뢰한다 (제출 시 재검증 없음).
//   결함 B: 비동기 결제(bank_debit)를 자금 확인 전에 즉시 개통한다.
//
// 목적: "왜 위험한가"를 로컬에서 눈으로 확인하기 위함.

const http = require("http");
const { isFormatValidIban } = require("./iban-format-check");

const PORT = 3000;

// 서버가 "정책상" 이 사용자에게 내려주려던 통로. (지역 등으로 결정했다고 가정)
const SERVER_INTENDED_FLOW = "card";

function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try { resolve(JSON.parse(data || "{}")); }
      catch { resolve({}); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  // 1) 결제 능력 조회 — 서버는 card를 의도한다
  if (req.method === "GET" && req.url.endsWith("/checkout_capabilities")) {
    return send(res, 200, { checkout_flow: SERVER_INTENDED_FLOW });
  }

  // 2) 결제 제출
  if (req.method === "POST" && req.url.endsWith("/checkout_submit")) {
    const body = await readJson(req);
    const flow = body.checkout_flow;   // ❌ 클라이언트가 보낸 값을 그대로 신뢰
    const account = body.account || "";

    if (flow === "bank_debit") {
      // ❌ 형식 검증만 하고, 실재성 확인/청산 확인 없이 즉시 개통
      if (isFormatValidIban(account)) {
        console.log("[VULN] bank_debit 형식검증 통과 → 즉시 개통 (자금 미확인)");
        return send(res, 200, {
          status: "subscription_active",
          note: "즉시 개통됨 — 청산은 T+1~3 뒤 (확인 공백)",
        });
      }
      return send(res, 400, { status: "invalid_account_format" });
    }

    if (flow === "card") {
      // 동기 승인 시뮬레이션 — 유효 카드 없으면 거절
      const approved = body.card && body.card.approved === true;
      console.log("[VULN] card 동기 승인:", approved);
      return send(res, approved ? 200 : 402, {
        status: approved ? "subscription_active" : "card_declined",
      });
    }

    return send(res, 400, { status: "unknown_flow", flow });
  }

  send(res, 404, { status: "not_found" });
});

server.listen(PORT, () => {
  console.log(`[VULN] 취약 목업 서버: http://localhost:${PORT}`);
  console.log(`[VULN] 서버 의도 통로 = ${SERVER_INTENDED_FLOW} (하지만 제출 시 재검증 안 함)`);
});
