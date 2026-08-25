// fixed-server.js
// 수정 구현 (로컬 목업). 실제 결제망과 통신하지 않는다.
//
// 닫은 결함:
//   결함 A 대응: 결제 통로를 서버가 세션에 바인딩하고, 제출 시 재검증한다.
//               클라이언트가 보낸 checkout_flow는 무시한다(참고용으로만 비교/로깅).
//   결함 B 대응: 비동기 결제(bank_debit)는 청산 확인 전까지 개통하지 않고
//               "처리 중(pending)" 상태만 반환한다.
//
// 목적: 동일한 공격 요청이 왜 막히는지 보이기.

const http = require("http");
const crypto = require("crypto");
const { isFormatValidIban } = require("./iban-format-check");

const PORT = 3001;
const SERVER_INTENDED_FLOW = "card";

// 서버가 세션별로 결정한 통로를 저장(데모용 인메모리). 실제론 세션스토어/서명토큰.
const sessions = new Map();

function send(res, code, obj) {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}
function readJson(req) {
  return new Promise((resolve) => {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => { try { resolve(JSON.parse(d || "{}")); } catch { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  // 1) 결제 능력 조회 — 서버가 통로를 결정하고 세션에 바인딩
  if (req.method === "GET" && req.url.endsWith("/checkout_capabilities")) {
    const sessionId = crypto.randomUUID();
    sessions.set(sessionId, { flow: SERVER_INTENDED_FLOW, ts: Date.now() });
    // 프론트에는 렌더용 값을 주되, 권위는 서버 세션에 있다.
    return send(res, 200, { checkout_flow: SERVER_INTENDED_FLOW, session_id: sessionId });
  }

  // 2) 결제 제출 — 서버 세션 기준으로 재검증
  if (req.method === "POST" && req.url.endsWith("/checkout_submit")) {
    const body = await readJson(req);
    const sess = sessions.get(body.session_id);

    // ✅ 결함 A 대응: 세션이 없거나, 클라이언트 flow가 서버 결정과 다르면 거부
    if (!sess) {
      return send(res, 400, { status: "no_session_rebuild_required" });
    }
    if (body.checkout_flow && body.checkout_flow !== sess.flow) {
      console.log(`[FIXED] 통로 불일치 거부: client=${body.checkout_flow}, server=${sess.flow}`);
      return send(res, 403, {
        status: "flow_mismatch_rejected",
        server_flow: sess.flow,
      });
    }

    const flow = sess.flow; // 권위는 항상 서버 값

    if (flow === "card") {
      const approved = body.card && body.card.approved === true;
      return send(res, approved ? 200 : 402, {
        status: approved ? "subscription_active" : "card_declined",
      });
    }

    // ✅ 결함 B 대응: 비동기 결제는 형식이 맞아도 즉시 개통 금지
    if (flow === "bank_debit") {
      if (!isFormatValidIban(body.account || "")) {
        return send(res, 400, { status: "invalid_account_format" });
      }
      console.log("[FIXED] bank_debit → pending (청산 확인까지 개통 보류)");
      return send(res, 202, {
        status: "payment_pending",
        note: "청산 성공 웹훅 수신 후에만 개통 (확인 공백 제거)",
      });
    }

    return send(res, 400, { status: "unknown_flow" });
  }

  send(res, 404, { status: "not_found" });
});

server.listen(PORT, () => {
  console.log(`[FIXED] 수정 목업 서버: http://localhost:${PORT}`);
  console.log("[FIXED] 통로는 서버 세션이 권위 / 비동기결제는 지연개통");
});
