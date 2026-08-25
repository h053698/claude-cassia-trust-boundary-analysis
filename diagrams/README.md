# 다이어그램

GitHub는 Mermaid를 렌더링한다. 아래 세 다이어그램은 (1) 정상 플로우, (2) 취약 플로우, (3) 신뢰경계와 확인 공백을 보여준다.

## 1. 정상 결제 플로우 (서버가 통로를 강제)

```mermaid
sequenceDiagram
    autonumber
    participant U as 사용자/브라우저
    participant S as Anthropic 백엔드
    participant P as 결제 게이트웨이
    U->>S: GET checkout_capabilities
    S-->>U: { checkout_flow: "stripe" }
    Note over U: 카드 폼 렌더
    U->>S: 카드 정보 제출
    S->>P: 동기 승인 요청
    P-->>S: 승인/거절 (밀리초)
    alt 승인됨
        S-->>U: 구독 개통
    else 거절됨
        S-->>U: 결제 실패
    end
```

## 2. 취약 플로우 (클라이언트가 통로를 덮어씀)

```mermaid
sequenceDiagram
    autonumber
    participant U as 사용자/브라우저
    participant X as 클라이언트측 조작<br/>(확장/프록시/devtools)
    participant S as 백엔드
    participant P as SEPA 청산
    U->>S: GET checkout_capabilities
    S-->>X: { checkout_flow: "stripe" }
    X-->>U: { checkout_flow: "cassia" }  ← 응답 조작
    Note over U: IBAN 폼 렌더
    U->>S: 형식만 유효한 IBAN 제출
    Note over S: ❌ 통로 자격 재검증 안 함<br/>❌ 형식 검증만 통과
    S-->>U: "성공" → 즉시 개통
    Note over U,P: ⏳ 확인 공백 T+1~T+3
    P-->>S: 청산 실패(R-코드)
    S-->>U: 뒤늦은 구독 취소
```

## 3. 신뢰경계와 두 결함의 곱셈

```mermaid
flowchart LR
    subgraph server["서버 통제 영역 (신뢰)"]
        policy["정책: checkout_flow 결정"]
    end
    subgraph client["클라이언트 영역 (신뢰 불가)"]
        render["렌더링 분기"]
        submit["결제 제출"]
    end
    policy -->|응답 전송| render
    render -.->|"결함 A: 값 조작 가능<br/>서버가 제출 시 재검증 X"| submit
    submit -->|"결함 B: 비동기 확인 공백<br/>대가 확정 전 개통"| grant["유료 기능 개통"]
    classDef bad fill:#ffe0e0,stroke:#c00;
    class render,submit bad;
```

> 결함 A(신뢰경계 붕괴)와 결함 B(확인 공백)는 각각 단독으로는 치명적이지 않지만, 곱해지면 "형식만 맞는 계좌 → 즉시 개통"의 완결된 사슬이 된다.
