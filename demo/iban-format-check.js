// iban-format-check.js
// ISO 7064 MOD 97-10 "형식" 검증기 (교육용).
//
// 이 파일이 보여주는 것: 형식 검증(MOD 97-10)은 "자릿수/체크섬이 맞는가"만 본다.
// 계좌가 실제로 존재하는가, 잔액이 있는가, 명의가 누구인가는 전혀 모른다.
// => 형식 유효성(format-valid)과 실재성(real)은 다른 개념이다.
//
// 이 파일은 "유효한 계좌번호 생성기"가 아니다. 주어진 문자열의 형식만 검사한다.

/**
 * IBAN 형식(MOD 97-10) 검증. 형식이 맞으면 true.
 * 주의: true여도 "실제 계좌"라는 뜻은 절대 아니다.
 */
function isFormatValidIban(raw) {
  if (typeof raw !== "string") return false;
  const iban = raw.replace(/\s+/g, "").toUpperCase();

  // 기본 형태: 2글자 국가코드 + 2자리 체크숫자 + 최대 30자 BBAN
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/.test(iban)) return false;

  // 앞 4자를 뒤로 이동
  const rearranged = iban.slice(4) + iban.slice(0, 4);

  // 문자 → 숫자 (A=10 ... Z=35)
  const numeric = rearranged.replace(/[A-Z]/g, (ch) =>
    (ch.charCodeAt(0) - 55).toString()
  );

  // 큰 수 MOD 97 (BigInt 없이 자릿수 누적)
  let remainder = 0;
  for (const digit of numeric) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

module.exports = { isFormatValidIban };

// 직접 실행 시 데모 출력
if (require.main === module) {
  const samples = [
    "DE89 3704 0044 0532 0130 00", // 형식 유효(문서에 흔히 쓰이는 예시값)
    "DE00 0000 0000 0000 0000 00", // 형식 무효
    "XX12 3456",                   // 형식 무효
  ];
  console.log("형식 검증 결과 (true == 형식만 유효, 실재성과 무관):");
  for (const s of samples) {
    console.log(`  ${s.padEnd(28)} -> ${isFormatValidIban(s)}`);
  }
  console.log(
    "\n교훈: 형식 검증 통과가 '실제 계좌'를 보장하지 않는다.\n" +
    "따라서 형식만 보고 서비스를 개통하면 안 된다."
  );
}
