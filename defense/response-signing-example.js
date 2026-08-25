// response-signing-example.js
// 중요 응답에 HMAC 서명을 붙이고 검증하는 최소 예시 (개념 시연).
//
// 주의: 서명은 만능이 아니다. 공격자가 프론트의 검증 로직까지 후킹하면
// 우회 가능하다. 하지만 공격 난도를 "JSON 필드 하나 수정"에서
// "서명 스킴 역공학 + 검증 우회"로 크게 올린다. 심층 방어의 한 겹.
//
// 진짜 권위는 여전히 "서버가 제출 시 재검증"에 있어야 한다. (checklist.md 참고)

const crypto = require("crypto");

// 서버만 아는 키 (데모용 상수 — 실제로는 환경변수/시크릿 매니저)
const SIGNING_KEY = process.env.CHECKOUT_SIGNING_KEY || "demo-server-only-key";

function signPayload(obj) {
  const body = JSON.stringify(obj);
  const sig = crypto.createHmac("sha256", SIGNING_KEY).update(body).digest("base64url");
  return { body: obj, sig };
}

// 서버가 되돌아온 값을 재검증할 때: 서명이 유효하고 위조되지 않았는지 확인
function verifyPayload(signed) {
  if (!signed || typeof signed.sig !== "string") return false;
  const body = JSON.stringify(signed.body);
  const expected = crypto.createHmac("sha256", SIGNING_KEY).update(body).digest("base64url");
  // 타이밍 안전 비교
  const a = Buffer.from(signed.sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { signPayload, verifyPayload };

if (require.main === module) {
  const issued = signPayload({ checkout_flow: "card", session: "s-123" });
  console.log("발급된 서명 응답:", JSON.stringify(issued));
  console.log("정상 검증:", verifyPayload(issued)); // true

  // 공격자가 body만 바꾸고 서명을 그대로 두면 검증 실패
  const tampered = { body: { ...issued.body, checkout_flow: "bank_debit" }, sig: issued.sig };
  console.log("변조 후 검증:", verifyPayload(tampered)); // false
}
