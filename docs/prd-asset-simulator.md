# PRD — JIPJIP 자산/노후 시뮬레이터 (Tab 확장)

| 항목 | 내용 |
|---|---|
| 문서명 | JIPJIP 자산/노후 시뮬레이터 PRD |
| 버전 | v1.0 (초안) |
| 작성일 | 2026-06-03 |
| 상태 | Draft (review 대기) |
| 대상 모듈 | (A) 탭 구조 도입, (B) 자산/노후 시뮬레이터 신규 탭 |
| 의존성 | Chart.js 4.4.1 (UMD), 기존 @neondatabase/serverless |
| 참고 문서 | `자산계산기 임시.md` (프로토타입, 본 PRD가 대체) |

---

## 1. 개요 (Overview)

기존 JIPJIP 서비스(매물 추적기)에 **탭 구조**를 도입하여 다음 두 모듈을 단일 페이지에서 전환 가능하게 한다.

- **탭 1 — 매물 추적기 (기존)**: 변경 없음, 동작 호환성 100% 유지.
- **탭 2 — 자산/노후 시뮬레이터 (신규)**: 부부의 현재 나이·자산·소득·저축률을 입력하면, **와이프 만 75세 실버타운 입주** 시점에 필요한 자산을 역산하고, 거기까지의 자산·소득 시계열을 그래프로 시각화한다.

핵심 가치: "막연한 노후 목표"를 **물가·수익률·저축률·부동산 가치 증가율을 만져볼 수 있는 숫자**로 바꾼다. 거주 기간(10/20/30년)에 따라 필요 자산이 어떻게 달라지는지도 함께 보여준다.

### 1.1 첨부 프로토타입 PRD와의 차이

| 항목 | 프로토타입 | 본 PRD |
|---|---|---|
| 와이프 나이(2026) | 30세 | **28세** |
| 남편 나이(2026) | 35세 | **33세** |
| 입주 시점 | 와이프 75세 (2071) | **와이프 75세 (2073)** |
| 기본 등급 | 상급 | **중급** |
| 거주 기간 | 10년 고정 | **10/20/30년 선택** |
| 자산 모델 | 단일 자산 (1-bucket) | **3-bucket (현금/투자/부동산)** |
| 부동산 | 미반영 | **별도 가치증가율, 입주 시 매도 옵션** |
| 입력 방식 | 슬라이더만 | **슬라이더 + 단계 버튼 + 직접 입력** |
| 영속 저장 | 없음 | **시나리오 DB 저장/로드/비교** |
| 국민연금 | 매우 단순 추정 | **가입연차 기반 추정 + 사용자 오버라이드** |

---

## 2. 배경 (Background)

- 부부는 자녀 계획이 없어 **상속/증여 고려 없이 본인들의 노년을 책임지는 자금 계획**이 필요하다.
- 와이프(28) 기준 75세 진입까지 **47년**이라는 긴 시계열에서, 물가·수익률·소득증가율의 작은 차이가 결과를 수 배 단위로 바꾼다.
- 자산은 **현금/투자/부동산**으로 구분되며, 각각 수익률·인플레 민감도가 다르다. 단일 버킷으로는 부동산 매도/보유 의사결정을 시뮬레이션할 수 없다.
- 실버타운 비용은 보증금(대부분 반환형)과 월 생활비로 구성되며, 거주 기간이 길어질수록 누적 생활비가 보증금을 압도한다.

---

## 3. 사용자 컨텍스트 (User Context)

| 항목 | 값 |
|---|---|
| 가구 구성 | 부부 (자녀 없음, 향후에도 무자녀 예정) |
| 기준 연도 | 2026 |
| 남편 나이 (2026) | 만 33세 (1993년생) |
| 와이프 나이 (2026) | 만 28세 (1998년생) |
| 와이프 연봉 (세전) | 5,800만원 |
| 남편 연봉 (세전, 상여 포함) | 5,600만원 |
| 직장 가입 시점 | 둘 다 2021년 |
| 국민연금 | 2021년부터 직장 가입 중 |
| 4대보험 | 가입 |
| 목표 실버타운 등급 | **중급** (기본 선택) |
| 입주 시점 | 와이프 만 75세 (2073) |
| 거주 예정 기간 | 10년 / 20년 / 길면 30년 |
| 입주 이후 | 노년 종착, 둘이서 마무리 |

### 3.1 가입연차 기반 국민연금 추정 베이스라인
- 2021년 가입 → 와이프 65세(2063) 수령 개시 시 **42년 가입** (504개월)
- 남편 65세(2058) 수령 개시 시 **37년 가입** (444개월)
- 국민연금공단 가입기간 최대 인정 480개월(40년) → 둘 다 만기 인정 가능
- 본 PRD는 단순 모델로 추정 (§7.4), 사용자 오버라이드 가능

---

## 4. 목표 & 성공지표

| 구분 | 내용 |
|---|---|
| 1차 목표 | 와이프 75세 시점 **거주 기간별(10/20/30년) 필요자산**을 명목/오늘가치로 산출 |
| 2차 목표 | 현재 → 75세까지 **자산 시계열**을 3-bucket (현금/투자/부동산)으로 시각화 |
| 3차 목표 | 슬라이더/단계/직접입력 어떤 방식이든 조작 시 **즉시 재계산 + 리렌더** |
| 4차 목표 | **시나리오 저장/로드/비교**로 "낙관/중립/비관" 케이스 나란히 검토 |
| 성공지표 1 | 사용자가 가정값을 바꾸며 "10년 / 20년 / 30년 거주 시 목표 달성 여부"를 즉시 확인 |
| 성공지표 2 | 부동산 매도/보유 의사결정의 자산 임팩트를 단일 클릭으로 비교 |
| 성공지표 3 | 매물 추적기 탭의 모든 기존 기능 회귀 없이 동작 |

---

## 5. 시스템 변경 — 탭 구조 도입

### 5.1 탭 네비게이션 사양

#### 5.1.1 구조
- `<header class="topbar">` 하단에 **탭 바** 추가
- 두 개 탭: `매물 추적기` (default) / `자산 시뮬레이터`
- 각 탭은 `<section data-tab="listings|simulator">` 로 마크업, 비활성 탭은 `hidden` 속성 적용

#### 5.1.2 라우팅
- URL 해시로 상태 보존: `#listings` (기본) / `#simulator`
- 페이지 로드 시 해시 읽어 활성화, 탭 클릭 시 `history.replaceState`로 해시 갱신
- 잘못된 해시는 `#listings`로 폴백
- `localStorage`에 마지막 활성 탭 저장 → 해시 없이 진입 시 복원

#### 5.1.3 UX
- 탭 버튼: 키보드 접근(`role="tab"`, `aria-selected`, `aria-controls`, `tabindex` 로테이션)
- 화살표 키 좌/우로 탭 이동, Enter/Space로 활성화
- 비활성 탭의 폼/스크립트 상태 보존(unmount 금지) — 탭 전환 시 입력값/스크롤 위치 유지
- 모바일(≤768px)에서는 탭 바를 sticky로 고정

### 5.2 매물 추적기 탭 — 변경 사항

기존 기능 100% 호환. 다음 외에는 수정 금지:
- `<section class="controls">`, `<main class="main-layout">`, `<dialog id="listingDialog">` 전부를 `<section data-tab="listings" role="tabpanel">` 로 감싼다.
- `app.js`의 DOM 셀렉터는 모두 `document.getElementById`/`document.querySelector` 기반이라 wrapping 영향 없음. 회귀 테스트 필수.
- `dbStatus` 배너는 탭 바 위로 이동(글로벌 상태이므로 두 탭 공통).

---

## 6. 자산 시뮬레이터 — 기능 명세

### 6.1 입력: 프로필 (Profile)

| 필드 | 단위 | 기본값 | 검증 |
|---|---|---|---|
| 기준 연도 | 년 | 2026 | 2020 ≤ x ≤ 2030 |
| 와이프 현재 나이 | 만 세 | 28 | 18 ≤ x ≤ 60 |
| 남편 현재 나이 | 만 세 | 33 | 18 ≤ x ≤ 65 |
| 입주 나이 (와이프 기준) | 만 세 | 75 | 60 ≤ x ≤ 90 |
| 거주 기간 | 년 (3-way 라디오) | 10년 | 10 / 20 / 30 (또는 직접 입력 5~40) |

### 6.2 입력: 자산 현황 (3-bucket)

| 필드 | 단위 | 기본값 | 비고 |
|---|---|---|---|
| 현금성 자산 (예·적금) | 만원 | 0 | 즉시 가용 자금 |
| 투자 자산 (주식·펀드·ETF 등) | 만원 | 0 | 시장 수익률 적용 |
| 부동산 자산 (현재 시세) | 만원 | 0 | 부동산 증가율 적용 |
| 부동산 보유 토글 | bool | OFF | OFF 시 부동산 입력/계산 전체 비활성 |
| 부동산 매도 시점 | enum | 입주 시점 | `입주시점 매도` / `유지` / `사용자 지정 연도` |
| 부동산 양도 비용 | % | 4 | 매도 시 차감 (양도세·중개비 합산 근사) |

### 6.3 입력: 소득

| 필드 | 단위 | 기본값 | 비고 |
|---|---|---|---|
| 와이프 세전 연봉 (현재) | 만원 | 5,800 | |
| 남편 세전 연봉 (현재) | 만원 | 5,600 | 상여 포함 |
| 실수령 환산 계수 | 0~1 | 0.83 | 4대보험+세금 근사. 슬라이더 0.70~0.90 |
| 소득증가율 (피크까지, 연복리) | % | 4.0 | 슬라이더 0~10 |
| 소득 피크 나이 (와이프 기준) | 세 | 55 | 슬라이더 45~60 |
| 피크 이후 횡보 | bool | ON | OFF 시 피크 이후 즉시 감소 |

### 6.4 입력: 실버타운 설정

#### 6.4.1 등급 선택 (Preset)
- 4개 버튼: `최상급` / `상급` / **`중급` (default)** / `하급`
- 등급 클릭 시 `보증금 / 월 생활비`가 자동 채워짐 (부록 A 참조), 사용자가 수동 수정 가능
- 사용자 수정 시 "사용자 정의" 라벨로 변경

#### 6.4.2 비용 입력 (등급 자동 채움 또는 수동)
| 필드 | 단위 | 중급 기본 | 비고 |
|---|---|---|---|
| 보증금 (2026 기준) | 억 | 3 | 명목 = 보증금 × (1+물가)^t |
| 월 생활비 (부부) | 만원 | 300 | 등급 자동 채움 |
| 보증금 반환형 | 토글 | ON | OFF 시 보증금도 소진 |
| 거주 중 의료비 가산율 | % | 1.5 | 일반 물가 + 가산 (요양 단계 대비) |

### 6.5 입력: 시뮬레이션 가정 (멀티-모드 입력)

각 항목은 **3가지 입력 방식**을 동시 제공한다:
1. **슬라이더** (선형, 연속): 빠른 탐색용
2. **단계 버튼 (Stepper)**: 의미 있는 단계 프리셋 (보수/중립/공격적 등)
3. **직접 입력**: 숫자 textbox, 소수 둘째 자리까지

| 항목 | 범위 | 기본값 | 단계 프리셋 |
|---|---|---|---|
| 물가상승률 | 0~8% | 3.0% | 보수 2 / 중립 3 / 공격 5 |
| 소득상승률 (피크까지) | 0~10% | 4.0% | 보수 2 / 중립 4 / 공격 6 |
| 투자자산 수익률 (명목) | 0~12% | 6.0% | 보수 3 / 중립 6 / 공격 9 |
| 현금성 수익률 (명목) | 0~6% | 2.5% | 보수 1.5 / 중립 2.5 / 공격 4 |
| 부동산 가치 증가율 | 0~8% | 3.0% | 보수 1 / 중립 3 / 공격 5 |
| 저축률 (실수령 대비) | 0~60% | 30% | 보수 15 / 중립 30 / 공격 45 |
| 신규 저축의 현금/투자 배분 | 0~100% | 현금 30 / 투자 70 | — |
| 거주 중 잔여자산 실질수익률 | -2~5% | 1.0% | 보수 0 / 중립 1 / 공격 3 |

### 6.6 입력: 은퇴 & 국민연금

| 필드 | 단위 | 기본값 | 비고 |
|---|---|---|---|
| 와이프 은퇴 나이 | 만 세 | 60 | 슬라이더 50~70 |
| 남편 은퇴 나이 | 만 세 | 60 | 슬라이더 50~70 |
| 국민연금 수령 개시 나이 | 만 세 | 65 | 슬라이더 60~70 |
| 국민연금 자동 추정 | 토글 | ON | §7.4 모델 사용 |
| 국민연금 월액 (수동) | 만원/부부 | (자동 산출) | 토글 OFF 시 사용자 직접 입력 |
| 연금 가입 시작 연도 | 년 | 2021 | 자동 추정 시 사용 |

### 6.7 입력: 버퍼 & 기타

| 필드 | 단위 | 기본값 | 비고 |
|---|---|---|---|
| 의료·예비비 버퍼 | 억(오늘가치) | 2 | 입주 시점에 추가로 확보해야 할 금액 |
| 사별 시나리오 | 토글 | OFF | (P2 로드맵, MVP에서는 비활성) |
| 인플레 가산: 의료/돌봄 | %p | +1.5 | 일반 물가 + 가산, 거주 중 생활비에 적용 |

### 6.8 출력: 메트릭 카드

거주 기간(10/20/30년)별로 **3개 컬럼**으로 동시 표시.

| 카드 | 설명 |
|---|---|
| 입주 시 필요자산 (명목) | 보증금 + 생활비 충당 자본 + 버퍼 |
| 오늘 가치 환산 | 명목 ÷ 물가배수 |
| 실제 소진 예상액 | 반환형이면 보증금 제외 |
| 예상 75세 자산 (명목) | 시뮬레이션 종착값 (3-bucket 합계) |
| 목표 대비 GAP | (+ 초과 / − 미달, 색상 구분: teal/red) |
| 현재 자산 → 목표 필요 수익률 | 추가 저축 0 가정 시 |
| 권장 연 저축 (오늘가치) | 목표 달성을 위해 필요한 연 저축액 |
| 첫해 실제 저축 (오늘가치) | 현재 입력값 기준 |
| 부동산 매도 시 순현금 (명목) | 매도 시점 부동산가 × (1 − 양도비용) |
| 국민연금 (75세 시점, 월/부부) | 자동 또는 수동 입력값 |

### 6.9 출력: 시계열 차트

#### 6.9.1 차트 1 — 자산 추이 (Stacked Area)
- X축: 와이프 나이 (현재~75)
- Y축: 명목 자산 (억)
- 시리즈 (적층): 현금 / 투자 / 부동산
- 입주 시점에 부동산 매도 옵션 켜져 있으면 매도 시점에 부동산이 현금/투자로 전환되는 모습 표시
- 거주 기간 종료선 3개 (10/20/30년 후) 점선으로 표기

#### 6.9.2 차트 2 — 소득 추이 (Line, 이중 Y축)
- X축: 와이프 나이
- 좌 Y축: 가구 소득 (만원/년)
- 우 Y축: 누적 저축 (억)
- 시리즈: 와이프 소득 / 남편 소득 / 국민연금 (둘 합산) / 누적 저축
- 은퇴 시점 / 연금 개시 시점 vline

#### 6.9.3 차트 3 — 실버타운 비용 vs 잔여 자산 (Line)
- X축: 거주 햇수 (0 ~ 30)
- Y축: 명목 (억)
- 시리즈: 잔여 자산 (실질 1% 수익 가정) / 누적 생활비 / 보증금 라인 (반환형 강조)
- 자산이 0이 되는 시점에 마커 표시 ("자금 고갈 N년차")

#### 6.9.4 차트 공통 사양
- 색상만으로 구분 금지: 실선/파선/점선 패턴 병행
- 커스텀 HTML 범례 (체크박스로 시리즈 토글)
- 다크모드 대응 (CSS 변수로 차트 색상 동적 결정)
- 툴팁: "와이프 N세 (서기 YYYY)" + 시리즈별 억 단위 + 오늘가치 환산
- `role="img"` + `aria-label` + 폴백 텍스트 (스크린리더용 핵심 수치 요약)

### 6.10 시나리오 저장/로드/비교

#### 6.10.1 저장
- 우상단 `시나리오 저장` 버튼 → 모달 → 이름 입력 → POST `/api/scenarios`
- 모든 입력값 + 계산 결과 스냅샷(`computed_snapshot`)을 함께 저장

#### 6.10.2 로드
- 좌측 사이드바에 시나리오 목록 (드롭다운 또는 칩)
- 클릭 시 입력값 일괄 적용 + 재계산

#### 6.10.3 비교 (MVP-Lite)
- 최대 3개 시나리오 선택 → 메트릭 카드 나란히 표시
- 차트는 단일 시나리오만 (P1: 차트 오버레이 비교)

#### 6.10.4 기본 시나리오
- 마이그레이션 시 `is_default = true` 시나리오 1개 자동 생성
- 사용자가 다른 시나리오를 기본으로 설정 가능 (1행만 true 보장)

---

## 7. 계산 로직

### 7.1 글로벌 정의 & 기호

| 기호 | 의미 |
|---|---|
| `t` | 기준 연도로부터 경과 연수 (정수, 0..47+) |
| `age_w(t)` | 와이프 나이 = 28 + t |
| `age_h(t)` | 남편 나이 = 33 + t |
| `year(t)` | 2026 + t |
| `infl` | 물가상승률 |
| `r_inv` | 투자자산 수익률 (명목) |
| `r_cash` | 현금성 수익률 (명목) |
| `r_re` | 부동산 가치 증가율 (명목) |
| `g_inc` | 소득증가율 |
| `s_rate` | 저축률 (실수령 대비) |
| `net_f` | 실수령 환산 계수 (0.83 기본) |
| `T_entry` | 입주 시점 t = (75 − 28) = 47 (기본) |
| `N_stay` | 거주 기간 (10/20/30) |
| `rr_stay` | 거주 중 잔여자산 실질수익률 |

### 7.2 인플레이션 모델
- 단일 물가율 `infl` 사용 (MVP).
- 거주 중 생활비에는 `infl + medical_premium` 적용 (의료/돌봄 가산).
- 부동산은 별도 `r_re` 사용.
- 오늘가치 환산: `today = nominal / (1 + infl)^t`

### 7.3 소득 모델
```
peak_t = peak_age − age_w0          # 와이프 기준 피크 시점
income_w(t):
  if age_w(t) < retire_w:
    if age_w(t) <= peak_age:
      base_w × (1 + g_inc)^t
    else:
      base_w × (1 + g_inc)^peak_t × (peak_flat ? 1 : (1 − decay)^(t − peak_t))
  else: 0

income_h(t): 동일 로직, base_h / retire_h 기준
gross(t) = income_w(t) + income_h(t)
net(t)   = gross(t) × net_f
```

### 7.4 국민연금 추정 모델 (단순)

**자동 추정 모드 (토글 ON)**:
```
years_contrib_w = min(retire_w − 23, 40)        # 2021년 가입 가정, 23세부터
years_contrib_h = min(retire_h − 28, 40)

# 단순 산식: 가입연차 × 평균소득 × 1.0% (소득대체율 근사)
# 평균소득은 실질가치로 base × 0.85 (재평가 가정)
pension_w_today = base_w × 0.85 × years_contrib_w × 0.01    # 만원/년
pension_h_today = base_h × 0.85 × years_contrib_h × 0.01

# 수령 개시 시점 명목으로 환산, 이후 매년 물가 연동
pension_at(t):
  if year(t) >= pension_start_year:
    (pension_w_today + pension_h_today) × (1 + infl)^t
  else: 0
```

**수동 모드 (토글 OFF)**:
- 사용자가 직접 월 수령액(부부 합산) 입력 → 자동으로 연 환산 후 매년 물가 연동.

### 7.5 자산 성장 모델 (3-bucket)

```
W_cash(0), W_inv(0), W_re(0): 사용자 입력 초기값

매년 (t → t+1):
  net_income = net(t) + pension_at(t)
  savings    = (age_w(t) < retire_w OR age_h(t) < retire_h) ? net_income × s_rate : 0
  to_cash    = savings × alloc_cash
  to_inv     = savings × (1 − alloc_cash)

  W_cash(t+1) = W_cash(t) × (1 + r_cash) + to_cash
  W_inv(t+1)  = W_inv(t)  × (1 + r_inv)  + to_inv
  W_re(t+1)   = W_re(t)   × (1 + r_re)

  # 부동산 매도 시점
  if t+1 == sell_year:
    proceeds = W_re(t+1) × (1 − re_sell_cost)
    W_inv(t+1) += proceeds    # 매도금은 투자버킷으로 (또는 사용자 지정)
    W_re(t+1)  = 0
```

### 7.6 부동산 처리

- **보유 (sell_mode = '유지')**: 입주 시점에도 부동산 보유. 입주 비용은 다른 자산에서 조달. 부동산은 75세 자산에 합산되지만 유동성 없음(메트릭 카드에 별도 표기).
- **입주 시점 매도 (default)**: `sell_year = T_entry`. 매도 대금은 투자 버킷으로 흡수.
- **사용자 지정 연도**: 사용자가 직접 매도 연도 지정.

### 7.7 실버타운 비용 모델

```
f_entry         = (1 + infl)^T_entry
deposit_nominal = deposit_2026 × f_entry
annual_today    = monthly × 12 / 10000           # 억/년 (오늘가치)

# 거주 중 인플레: infl + medical_premium
infl_stay = infl + medical_premium
rr_real   = (1 + rr_stay_nominal) / (1 + infl_stay) − 1   # 실질
# rr_stay_nominal은 입력값으로 받거나 기본은 인플레 + 1%p

if rr_real <= 0:
  fee_factor = N_stay
else:
  x = 1 / (1 + rr_real)
  fee_factor = (1 − x^N_stay) / (1 − x)

K_fees     = annual_today × f_entry × fee_factor
buffer_nom = buffer_today × f_entry

total_need = deposit_nominal + K_fees + buffer_nom
total_today = total_need / f_entry
net_spent  = K_fees + buffer_nom + (refundable ? 0 : deposit_nominal)
```

### 7.8 통합 시뮬레이션 알고리즘

```
function simulate(inputs) {
  const t_max = inputs.entry_t + max(N_stay options) = 47 + 30 = 77
  const series = []
  let W = { cash: ..., inv: ..., re: ... }
  
  for (let t = 0; t <= t_max; t++) {
    series.push({
      t, year: 2026+t, age_w: 28+t, age_h: 33+t,
      cash: W.cash, inv: W.inv, re: W.re,
      total: W.cash + W.inv + W.re,
      income_gross: gross(t),
      income_net: net(t),
      pension: pension_at(t),
      savings: ...,
    })
    if (t < t_max) W = step(W, t)
  }
  
  return {
    series,
    targets: { stay10: ..., stay20: ..., stay30: ... },
    metrics: { ... }
  }
}
```

### 7.9 출력값 계산

```
# 거주 기간별 필요자산
needs(N) = {
  total_nominal: deposit_nominal + K_fees(N) + buffer_nom,
  total_today:   needs.total_nominal / f_entry,
  net_spent:     K_fees(N) + buffer_nom + (refundable ? 0 : deposit_nominal),
}

# 예상 자산 (75세 시점)
W75 = series[T_entry]
gap(N) = W75.total − needs(N).total_nominal

# 필요 CAGR (추가 저축 0 가정)
required_cagr(N) = (needs(N).total_nominal / W_total_today)^(1/T_entry) − 1

# 권장 연 저축 (오늘가치)
# 6% 명목, 47년 → 연금 미적용 단순 추정
recommended_save = (needs(N).total_today − W_total_today × (1+r_real)^T_entry) /
                   (((1+r_real)^T_entry − 1) / r_real)
```

---

## 8. 데이터 모델 (DB 스키마)

### 8.1 신규 테이블

#### `silver_town_tiers`
실버타운 등급 프리셋 (사용자/관리자가 시세 변화 시 업데이트 가능).

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | text PK | `top` / `high` / `mid` / `low` |
| label | text | 표시명 (`최상급` 등) |
| deposit_base | numeric(15,2) | 보증금 (만원, 2026 기준) |
| monthly_cost_base | numeric(10,2) | 부부 월 생활비 (만원) |
| refundable | boolean | 반환형 기본값 |
| notes | text | 등급 설명 |
| display_order | integer | UI 정렬 순서 |
| updated_at | timestamptz | |

#### `asset_scenarios`
사용자 시나리오. 모든 입력값 + 계산 스냅샷 저장.

| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| name | text NOT NULL | "낙관 시나리오" 등 |
| description | text | |
| is_default | boolean default false | 한 행만 true 보장 (앱 레벨) |
| **프로필** | | |
| base_year | integer | 2026 |
| wife_age | integer | 28 |
| husband_age | integer | 33 |
| entry_age | integer | 75 |
| stay_years | integer | 10/20/30 |
| **자산** | | |
| cash_current | numeric(15,2) | 만원 |
| investment_current | numeric(15,2) | |
| real_estate_current | numeric(15,2) | |
| has_real_estate | boolean | |
| sell_mode | text | `at_entry` / `keep` / `custom` |
| sell_year_custom | integer | nullable |
| re_sell_cost_rate | numeric(5,4) | 0.04 |
| **소득** | | |
| wife_income | numeric(15,2) | 만원 |
| husband_income | numeric(15,2) | |
| income_start_year | integer | 2021 |
| net_factor | numeric(5,4) | 0.83 |
| income_growth_rate | numeric(5,4) | 0.04 |
| income_peak_age | integer | 55 |
| income_peak_flat | boolean | true |
| **실버타운** | | |
| tier_id | text FK → silver_town_tiers | |
| deposit_override | numeric(15,2) | nullable |
| monthly_cost_override | numeric(10,2) | nullable |
| refundable | boolean | |
| medical_premium_rate | numeric(5,4) | 0.015 |
| **가정** | | |
| inflation_rate | numeric(5,4) | 0.03 |
| investment_return | numeric(5,4) | 0.06 |
| cash_return | numeric(5,4) | 0.025 |
| real_estate_return | numeric(5,4) | 0.03 |
| savings_rate | numeric(5,4) | 0.30 |
| savings_alloc_cash | numeric(5,4) | 0.30 |
| in_residence_real_return | numeric(5,4) | 0.01 |
| **은퇴/연금** | | |
| retire_age_wife | integer | 60 |
| retire_age_husband | integer | 60 |
| pension_start_age | integer | 65 |
| pension_auto | boolean | true |
| pension_monthly_override | numeric(10,2) | nullable |
| **버퍼** | | |
| medical_buffer_today | numeric(10,2) | 만원 (today's value) |
| **메타** | | |
| computed_snapshot | jsonb | 계산 결과 캐시 |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### 8.2 Constraints / Indexes
- `silver_town_tiers.id` PK
- `asset_scenarios.tier_id` FK ON DELETE RESTRICT
- 입력값 범위 체크는 앱 레벨 (CHECK constraint 최소화 — 추후 등급 추가 등 유연성 확보)
- 인덱스: `asset_scenarios(created_at DESC)`, `asset_scenarios(is_default) WHERE is_default = true`

### 8.3 트리거
- 기존 `set_updated_at()` 함수 재사용 → `asset_scenarios_set_updated_at` 트리거 추가

### 8.4 시드 데이터
- `silver_town_tiers` 4행 (부록 A)
- `asset_scenarios` 1행: 사용자의 기본값 (`is_default = true`)

---

## 9. API 명세

기존 `server.mjs` 패턴(`@neondatabase/serverless`) 동일 사용.

### 9.1 Endpoints

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/tiers` | 실버타운 등급 프리셋 전체 |
| GET | `/api/scenarios` | 시나리오 목록 (id, name, is_default, updated_at) |
| GET | `/api/scenarios/:id` | 시나리오 단건 (모든 입력값 + computed_snapshot) |
| POST | `/api/scenarios` | 신규 시나리오 생성 |
| PUT | `/api/scenarios/:id` | 시나리오 수정 |
| DELETE | `/api/scenarios/:id` | 시나리오 삭제 (기본 시나리오는 삭제 거부 → 400) |
| POST | `/api/scenarios/:id/set-default` | 기본 시나리오 변경 (트랜잭션으로 다른 행 false) |

### 9.2 Request/Response 예
```http
POST /api/scenarios
Content-Type: application/json

{
  "name": "중립 시나리오",
  "stay_years": 20,
  "tier_id": "mid",
  "cash_current": 5000,
  "investment_current": 15000,
  "real_estate_current": 50000,
  "has_real_estate": true,
  ...
}
```
응답:
```json
{ "id": "uuid", "name": "중립 시나리오", "created_at": "..." }
```

### 9.3 에러 처리
- 422: 검증 실패 (필드별 메시지)
- 404: 시나리오 없음
- 400: 비즈니스 룰 위반 (기본 시나리오 삭제 등)
- 500: DB 에러 → 사용자 메시지는 "일시적 오류, 다시 시도해주세요"

---

## 10. UI/UX 사양

### 10.1 레이아웃 (자산 시뮬레이터 탭)
- 좌측 30%: **입력 패널** (스크롤, 섹션별 접기/펼치기)
- 우측 70%: **출력 패널** (메트릭 카드 그리드 + 차트 3개 세로 배치)
- 모바일(≤768px): 입력/출력 세로 적층, 입력이 위

### 10.2 입력 패널 섹션
1. 시나리오 (저장/로드/비교)
2. 프로필 (§6.1)
3. 자산 현황 (§6.2)
4. 소득 (§6.3)
5. 실버타운 설정 (§6.4)
6. 시뮬레이션 가정 (§6.5)
7. 은퇴 & 연금 (§6.6)
8. 버퍼 & 기타 (§6.7)

### 10.3 멀티-모드 입력 컴포넌트
- 한 줄에 [슬라이더 ━━●━━] [Stepper: 보수/중립/공격] [숫자 입력]
- 세 요소는 양방향 동기화
- 슬라이더 드래그 중에는 200ms 디바운스 후 재계산

### 10.4 메트릭 카드
- 거주 기간 탭 (10년/20년/30년) 위에 가로 토글
- 카드 그리드 4×2 (또는 모바일 2×4)
- 목표 미달 카드는 빨강 테두리, 초과는 초록

### 10.5 시각적 일관성
- 기존 `styles.css` 디자인 토큰(색상, 폰트, 라운드) 재사용
- 신규 컴포넌트는 BEM 또는 `.sim__*` 네임스페이스로 격리
- 다크모드: 기존이 지원하면 동일하게 적용, 없으면 본 PRD 범위 외

---

## 11. 비기능 요구사항

| 항목 | 요구사항 |
|---|---|
| 반응성 | 입력 변경 후 200ms 이내 재계산·리렌더 |
| 성능 | 시뮬레이션 1회 < 10ms (브라우저), 차트 리렌더 < 100ms |
| 접근성 | 차트 `role="img"` + `aria-label`, 슬라이더 `aria-valuemin/max/now`, 키보드 풀 지원 |
| 다크모드 | 기존 지원 시 유지, 신규 색상 토큰화 |
| 숫자 포맷 | 화면 표기는 반올림 (억 1자리, % 1자리), 내부 계산은 풀 정밀도 |
| 의존성 | Chart.js 4.4.1 (UMD, CDN) — 신규 |
| 영속성 | 시나리오는 Neon DB 저장, 입력 중간 상태는 `localStorage` 자동 복원 |
| 브라우저 지원 | 최신 Chrome/Edge/Safari/Firefox (ES2022 OK) |
| 번들 크기 | app.js 추가분 < 30KB minified |

---

## 12. 에러 케이스 & 입력 검증

### 12.1 클라이언트 검증
| 케이스 | 처리 |
|---|---|
| 와이프 나이 ≥ 입주 나이 | 빨강 헬프텍스트, 계산 중지 |
| 거주 기간 ≤ 0 | 1로 클램프 |
| 보증금 + 월생활비 모두 0 | 경고 토스트, 계산은 진행 (목표=버퍼만) |
| 슬라이더 범위 밖 직접 입력 | 범위로 클램프 + 토스트 |
| 부동산 매도 연도가 입주 이전 | 허용 (사용자 의도) |
| 음수 자산 입력 | 거부, 빨강 헬프텍스트 |
| 부동산 매도 시점 > 입주 시점 + 거주기간 | 경고만 |

### 12.2 서버 검증
- 모든 numeric 필드 type check
- `stay_years ∈ [1, 50]`, `entry_age ∈ [50, 95]`
- `tier_id`는 `silver_town_tiers`에 존재해야 함
- `pension_auto = false`이면 `pension_monthly_override` 필수
- 검증 실패 → 422 + 필드별 메시지 (`{ errors: { field: "메시지" } }`)

### 12.3 계산 엣지 케이스
| 케이스 | 처리 |
|---|---|
| `r_inv = 0`이고 저축 = 0 | `W` 상수 유지 |
| `infl < 0` (디플레) | 허용, 물가배수 < 1 |
| `feeFactor` 분모 ≈ 0 (rr_real ≈ 0) | 별도 분기 `feeFactor = N_stay` |
| 자산이 거주 중 음수로 떨어짐 | 0으로 클램프 + "고갈 N년차" 표시 |
| 시뮬레이션 NaN/Infinity | 에러 토스트 + 콘솔 로그 |

---

## 13. 보안 & 프라이버시

### 13.1 데이터 분류
- 시나리오 데이터는 **개인 재무 정보** — 민감.
- 현재 jipjip은 인증 없음. 본 PRD도 인증 도입 범위 외이나, **공개 배포 시 인증 필수** (P0 후속 작업).

### 13.2 MVP 보안 조치
- 서버는 `127.0.0.1` 바인딩 기본 (`.env.example`의 `HOST=127.0.0.1`).
- 외부 노출 시 (배포 시) BasicAuth 또는 토큰 가드 추가 권장 — **본 PRD 범위 외, 별도 작업 필요**.
- DB 연결은 SSL 강제 (`sslmode=require` 기본).
- 시나리오 ID는 UUID v4 — 추측 어려움.

### 13.3 로깅
- 서버 로그에 PII(연봉, 자산 금액) 출력 금지
- 에러 로그는 ID + 에러 코드만

### 13.4 클라이언트 저장
- `localStorage`에 시나리오 입력 캐시 저장 — 공용 PC 사용 주의 문구 표시
- "캐시 비우기" 버튼 제공

---

## 14. 테스트 기준 (Acceptance Criteria)

### 14.1 단위 테스트 (계산 로직)
- [ ] `f_entry` 계산: infl=0.03, T=47 → ≈ 3.957
- [ ] `K_fees` 계산: 중급 기본값 + 10년 → 부록 C 예시와 ±1% 이내 일치
- [ ] `pension_at(t)` 자동 추정: 와이프 65세 시점 ≥ 0
- [ ] 자산 시뮬레이션: 저축 0 + 수익률 0이면 t에 무관하게 W = W0
- [ ] 부동산 매도: sell_year 시점에 W_re = 0, W_inv += proceeds
- [ ] feeFactor: rr=0 분기와 rr≠0 분기 둘 다 정확

### 14.2 통합 테스트
- [ ] 기본 시나리오 (와이프 28 / 중급 / 10년) 로드 → 메트릭 카드 채워짐
- [ ] 거주 기간 토글 (10→20→30) → 카드 즉시 갱신
- [ ] 등급 클릭 (중급→상급) → 보증금/월생활비 자동 채움
- [ ] 부동산 매도 토글 → 차트 1에 매도 시점 반영
- [ ] 시나리오 저장 → 리로드 → 동일 입력값 복원
- [ ] 기본 시나리오 삭제 시도 → 400 에러
- [ ] 잘못된 `tier_id` 저장 시도 → 422 에러

### 14.3 회귀 테스트 (매물 추적기 탭)
- [ ] 매물 목록 로드
- [ ] 필터 (날짜/상태/정렬) 동작
- [ ] 매물 추가/수정/삭제 다이얼로그
- [ ] 임장 일정 토글
- [ ] 체크리스트/평가/메모 저장
- [ ] 모든 기존 API 응답 형식 동일

### 14.4 접근성 테스트
- [ ] 키보드만으로 탭 전환
- [ ] 키보드만으로 모든 슬라이더 조작
- [ ] 스크린리더로 메트릭 카드 + 차트 요약 읽힘
- [ ] 색맹 시뮬레이션에서 차트 시리즈 구분 가능 (실선/파선/점선)

### 14.5 성능 테스트
- [ ] 슬라이더 빠른 드래그 → 프레임 드롭 없음
- [ ] 시나리오 100개 목록 로드 < 500ms
- [ ] 메모리 누수 없음 (DevTools 1분 사용 후 heap 동일)

---

## 15. 마이그레이션 SQL (요약)

전체 SQL은 `migrations/002_asset_simulator.sql` 참조. 핵심 변경:

1. `silver_town_tiers` 테이블 생성 + 4개 등급 시드
2. `asset_scenarios` 테이블 생성 (기존 `set_updated_at()` 함수 재사용)
3. 인덱스: `(created_at DESC)`, `(is_default) WHERE is_default = true`
4. 기본 시나리오 1개 삽입 (`is_default = true`)
5. 롤백 SQL은 파일 하단 주석 (`-- ROLLBACK:` 섹션)

**적용 방식**: 사용자가 Neon 콘솔 SQL Editor에서 직접 실행 또는 `psql $DATABASE_URL -f migrations/002_asset_simulator.sql` (DATABASE_URL 제공 후).

**기존 `001_init.sql`과의 관계**: 독립적. `listings` 테이블에는 영향 없음.

---

## 16. 한계 & 가정 리스크

1. **단일 물가율**: 의료/돌봄 가산만 적용. 식료품·주거·교통 등 세부 분리 미반영.
2. **국민연금 단순 추정**: 실제 노령연금 산식(`A값`, `B값`, 재평가율)을 정확히 반영하지 않음. ±20% 오차 가능. 정확한 예상연금은 [국민연금공단 내연금 알아보기](https://www.nps.or.kr/jsppage/main.jsp) 참조 권장.
3. **세금**: 실수령 환산 계수 단일값(0.83). 소득 증가에 따른 누진세 미반영.
4. **부동산**: 단일 자산. 다주택/임대수익/대출 미반영.
5. **사별 시나리오**: 한 명 사망 후 1인 거주 비용 미반영 (P2 로드맵).
6. **요양 전환**: 자립 → 돌봄 → 요양 단계 미세분화 (단순 가산율로 처리).
7. **세제 정밀화**: 금융소득 종합과세, 양도세 누진 미반영.
8. **물가 음수 (디플레)**: 계산은 동작하나 결과 해석 주의.
9. **모델 위험**: 47년 시계열 예측은 본질적으로 불확실. 본 도구는 **의사결정 보조**이지 예측이 아님.

---

## 17. 향후 로드맵 (Future Enhancements)

| 우선순위 | 항목 | 내용 |
|---|---|---|
| P0 | 인증 도입 | 배포 시 BasicAuth 또는 OAuth |
| P0 | 60~75세 인출 시나리오 정밀화 | 은퇴 후 ~ 입주 전 생활비를 자산에서 인출 |
| P1 | 시나리오 차트 오버레이 비교 | 최대 3개 시나리오 동일 차트에 |
| P1 | 사별 시나리오 | 1인 거주 비용 분기, 잔존배우자 자산 흐름 |
| P1 | 국민연금 정밀 추정 | A값/B값 기반, 실제 산식 |
| P2 | 세제 정밀화 | 누진세, 금융소득 종합과세 |
| P2 | 요양 단계 모델 | 자립 → 돌봄 → 요양 비용 곡선 |
| P2 | 부동산 정밀화 | 다주택, 임대수익, 주담대 |
| P3 | PDF 내보내기 | 시나리오 보고서 출력 |
| P3 | 시나리오 공유 | URL 토큰으로 읽기 전용 공유 |

---

## 부록 A — 등급별 비용 데이터 (2026 기준)

| 등급 | 보증금 | 월 생활비(부부) | 반환형 | 비고 |
|---|---|---|---|---|
| 최상급 | 9억 (90,000만) | 600만 | ✅ | 더클래식500급, 서울 강남권 |
| 상급 | 5억 (50,000만) | 400만 | ✅ | 서울 중상위권 |
| **중급 (default)** | **3억 (30,000만)** | **300만** | ✅ | **수도권 외곽 평균치** |
| 하급 | 1.5억 (15,000만) | 200만 | ✅ | 지방/소형 |

출처 (프로토타입 PRD 참조):
- 한국경제: https://www.hankyung.com/article/2023011538941
- 대한데일리: https://www.dhdaily.co.kr/news/articleView.html?idxno=23372
- 비바100: https://www.viva100.com/article/20250117500776
- KB: https://kbthink.com/main/living-finance/leisure/lifestyle/2024/gw-lifestyle-240227.html

> 등급 비용은 `silver_town_tiers` 테이블로 관리하므로 시세 변화 시 UPDATE만으로 갱신 가능.

---

## 부록 B — 참조 구현 의사코드

### B.1 시뮬레이션 코어 (JavaScript)

```js
const NET_FACTOR = 0.83;

function pension(t, inputs) {
  if (!inputs.pension_auto) {
    // 수동: 월액 → 연액, 매년 물가 연동
    const start_t = inputs.pension_start_age - inputs.wife_age;
    return t >= start_t
      ? inputs.pension_monthly_override * 12 * Math.pow(1 + inputs.inflation_rate, t)
      : 0;
  }
  // 자동 추정 (와이프 65세 = pension_start_age 시점)
  const wifeStart = inputs.pension_start_age - inputs.wife_age;
  if (t < wifeStart) return 0;
  const yearsW = Math.min(inputs.retire_age_wife - 23, 40);
  const yearsH = Math.min(inputs.retire_age_husband - 28, 40);
  const baseW = inputs.wife_income * 0.85 * yearsW * 0.01;   // 만원/년
  const baseH = inputs.husband_income * 0.85 * yearsH * 0.01;
  return (baseW + baseH) * Math.pow(1 + inputs.inflation_rate, t);
}

function incomeAt(t, inputs) {
  const ageW = inputs.wife_age + t;
  const ageH = inputs.husband_age + t;
  const peak_t_w = Math.max(0, inputs.income_peak_age - inputs.wife_age);
  const wInc = ageW < inputs.retire_age_wife
    ? inputs.wife_income * Math.pow(1 + inputs.income_growth_rate, Math.min(t, peak_t_w))
    : 0;
  // 남편도 동일 패턴 (피크는 남편 동일 연차 기준)
  const peak_t_h = Math.max(0, (inputs.income_peak_age + (inputs.husband_age - inputs.wife_age)) - inputs.husband_age);
  const hInc = ageH < inputs.retire_age_husband
    ? inputs.husband_income * Math.pow(1 + inputs.income_growth_rate, Math.min(t, peak_t_h))
    : 0;
  return { wife: wInc, husband: hInc, gross: wInc + hInc };
}

function simulate(inputs) {
  const T_entry = inputs.entry_age - inputs.wife_age;
  const T_max = T_entry + 30; // 거주 30년까지 시뮬
  const series = [];
  let W = {
    cash: inputs.cash_current,
    inv:  inputs.investment_current,
    re:   inputs.has_real_estate ? inputs.real_estate_current : 0,
  };
  const sellYear =
    inputs.sell_mode === 'at_entry' ? T_entry :
    inputs.sell_mode === 'custom'   ? inputs.sell_year_custom :
    Infinity;

  for (let t = 0; t <= T_max; t++) {
    const inc = incomeAt(t, inputs);
    const pen = pension(t, inputs);
    const netIncome = inc.gross * inputs.net_factor + pen;
    const stillWorking = (inputs.wife_age + t) < inputs.retire_age_wife
                       || (inputs.husband_age + t) < inputs.retire_age_husband;
    const savings = stillWorking ? netIncome * inputs.savings_rate : 0;
    const toCash = savings * inputs.savings_alloc_cash;
    const toInv  = savings - toCash;

    series.push({
      t, year: 2026 + t,
      ageW: inputs.wife_age + t, ageH: inputs.husband_age + t,
      cash: W.cash, inv: W.inv, re: W.re,
      total: W.cash + W.inv + W.re,
      income: inc, pension: pen, netIncome, savings,
    });

    // step
    W.cash = W.cash * (1 + inputs.cash_return) + toCash;
    W.inv  = W.inv  * (1 + inputs.investment_return) + toInv;
    W.re   = W.re   * (1 + inputs.real_estate_return);

    if (t + 1 === sellYear && W.re > 0) {
      const proceeds = W.re * (1 - inputs.re_sell_cost_rate);
      W.inv += proceeds;
      W.re = 0;
    }
  }

  // 거주 기간별 needs
  const f_entry = Math.pow(1 + inputs.inflation_rate, T_entry);
  const deposit_2026 = inputs.deposit_override ?? tierDeposit(inputs.tier_id);
  const monthly_2026 = inputs.monthly_cost_override ?? tierMonthly(inputs.tier_id);
  const annual_today = monthly_2026 * 12 / 10000; // 억
  const deposit_nom = deposit_2026 / 10000 * f_entry; // 억
  const buffer_nom  = inputs.medical_buffer_today / 10000 * f_entry;
  const infl_stay   = inputs.inflation_rate + inputs.medical_premium_rate;
  const rr_real     = (1 + inputs.in_residence_real_return + inputs.inflation_rate) / (1 + infl_stay) - 1;
  const needs = {};
  for (const N of [10, 20, 30]) {
    const fee_factor = Math.abs(rr_real) < 1e-6
      ? N
      : (1 - Math.pow(1/(1+rr_real), N)) / (1 - 1/(1+rr_real));
    const K = annual_today * f_entry * fee_factor;
    needs[`stay${N}`] = {
      total_nominal: deposit_nom + K + buffer_nom,
      total_today:   (deposit_nom + K + buffer_nom) / f_entry,
      net_spent:     K + buffer_nom + (inputs.refundable ? 0 : deposit_nom),
    };
  }

  return { series, needs, T_entry, f_entry };
}
```

### B.2 탭 라우터 (JavaScript)

```js
const TABS = ['listings', 'simulator'];

function activateTab(name) {
  if (!TABS.includes(name)) name = 'listings';
  document.querySelectorAll('[data-tab]').forEach(el => {
    el.hidden = el.dataset.tab !== name;
  });
  document.querySelectorAll('[role="tab"]').forEach(btn => {
    const active = btn.dataset.target === name;
    btn.setAttribute('aria-selected', active);
    btn.tabIndex = active ? 0 : -1;
  });
  history.replaceState(null, '', `#${name}`);
  localStorage.setItem('jipjip:lastTab', name);
}

window.addEventListener('DOMContentLoaded', () => {
  const fromHash = location.hash.slice(1);
  const fromStorage = localStorage.getItem('jipjip:lastTab');
  activateTab(fromHash || fromStorage || 'listings');
});
```

---

## 부록 C — 기준 시나리오 계산 예시

**입력**: 와이프 28 / 남편 33 / 중급(3억, 월 300만) / 물가 3% / 투자수익 6% / 현재 자산: 현금 1억 + 투자 2억 + 부동산 5억 / 저축률 30% / 부동산 입주시 매도

**파생**:
- T_entry = 47 (와이프 75세 = 2073)
- f_entry = 1.03^47 ≈ 3.957
- 보증금 명목 = 3억 × 3.957 ≈ **11.87억**
- 연 생활비 명목 (입주 시) = 3,600만 × 3.957 ≈ **1.42억/년**
- 부동산 매도 (T=47): W_re × 1.03^47 × 0.96 ≈ 5억 × 3.957 × 0.96 ≈ **18.99억** → 투자 버킷 흡수

**거주 기간별 필요자산** (반환형, 거주 중 실질수익 1%, 의료 가산 1.5%p):
- infl_stay = 3% + 1.5% = 4.5%
- rr_real = (1+0.06)/(1+0.045) - 1 ≈ 1.44%/년 (※ 단순 명목 6% 가정)
- N=10: fee_factor ≈ 9.27 → K_fees ≈ 1.42 × 9.27 ≈ **13.17억**
- N=20: fee_factor ≈ 17.40 → K_fees ≈ **24.71억**
- N=30: fee_factor ≈ 24.55 → K_fees ≈ **34.86억**
- 버퍼 명목 = 2억 × 3.957 ≈ 7.91억

**총 필요자산 (명목)**:
- 10년 거주: 11.87 + 13.17 + 7.91 = **32.95억** (실제 소진 21.08억)
- 20년 거주: 11.87 + 24.71 + 7.91 = **44.49억** (실제 소진 32.62억)
- 30년 거주: 11.87 + 34.86 + 7.91 = **54.64억** (실제 소진 42.77억)

> **수치는 예시이며 실제 PRD 구현 시 정밀 계산으로 검증 필요. ±5% 오차 허용.**

---

*본 문서의 수치는 가정 기반 시뮬레이션이며 투자·재무 자문이 아니다. 실제 결정 시 전문가 상담을 권장한다.*
