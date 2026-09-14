# cmds-share-server

> [🇬🇧 English](README.md) · 🇰🇷 한국어

[CMDS Share](https://github.com/johnfkoo951/cmds-share) Obsidian 플러그인의 거버넌스 서버 — 공유 노트를 서빙하며 서버 측 레지스트리(조회수·만료·취소)를 관리합니다. 레퍼런스 인스턴스는 **share.cmdspace.work** (CMDSPACE 초대제 운영).

> [CMDSPACE](https://cmdspace.work) 생태계의 일부입니다. By CMDSPACE.

## 스택

Next.js (App Router) + Supabase (Postgres + private Storage) + Vercel.

## 자체 호스팅 (권장 사용 방식)

1. Supabase 프로젝트 생성 → `supabase/migrations/0001_init.sql` 실행 → **private** 버킷 `share-files` 생성
2. 환경변수 (`.env.example` 참조): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CMDS_API_TOKENS`(콤마 구분 토큰 목록), `PUBLIC_BASE_URL`, `CRON_SECRET`
3. `vercel deploy --prod` + 도메인 연결
4. 플러그인 설정에서 Server URL을 본인 도메인으로, API token에 본인 토큰 입력

**주의**: 토큰은 인스턴스 전체 권한입니다 — 인스턴스 하나 = 한 사람(또는 신뢰하는 한 팀).

## 멤버와 토큰

토큰은 대시보드 **Members** 탭에서 발급합니다(관리자 전용). 이름을 적고 *Issue token*을 누른 뒤
나온 비밀값을 멤버에게 전달하면 끝입니다. 같은 탭에서 토큰별로 사용된 적이 있는지, 마지막 사용
시각, 그 사람이 올린 공유물 수를 함께 보여주므로 놀고 있는 토큰이 눈에 띕니다.

저장되는 것은 sha256 해시뿐입니다. 원본 비밀값은 발급 순간 한 번만 보이며, 잃어버리면 복구가
아니라 삭제 후 재발급입니다.

기존 `CMDS_API_TOKENS`도 폴백으로 계속 인증되므로, 테이블 도입 전에 토큰을 받은 멤버는 아무
영향이 없습니다. 해당 항목들은 Members 탭에 **Adopt** 버튼과 함께 표시되며, 누르면 같은 비밀값
그대로 DB로 옮겨집니다 — 멤버 쪽은 바꿀 것이 없습니다. 전부 이관한 뒤 환경변수를 비우고
재배포하면 됩니다.

## API

| 라우트 | 인증 | 용도 |
|---|---|---|
| `POST /v1/file/upload` | `x-cmds-token` | HTML/CSS/자산 업로드 (raw bytes + `x-cmds-*` 메타 헤더) |
| `POST /v1/file/delete` | `x-cmds-token` | 파일 + 레지스트리 삭제 |
| `GET /v1/notes` | `x-cmds-token` | 공유 목록 (CMS/대시보드) |
| `POST /v1/notes/revoke` | `x-cmds-token` | 소프트 취소/복구 |
| `GET·POST /v1/tokens` | 관리자 토큰 | 멤버 토큰 목록 / 발급 |
| `PATCH·DELETE /v1/tokens/{id}` | 관리자 토큰 | 활성·비활성, 이름 변경, 삭제 |
| `POST /v1/tokens/adopt` | 관리자 토큰 | `CMDS_API_TOKENS` 항목을 같은 비밀값 그대로 DB로 이관 |
| `GET /{shortId}` | 공개 | 공유 노트 서빙 (404 / 410 만료·취소 / 조회수 집계) |
| `GET /f/…` | 공개 | 콘텐츠 주소 기반 파일, immutable 캐시 |
| `GET /` | 토큰 (UI) | 공유 관리 대시보드 |
| `GET /api/cron/purge` | `CRON_SECRET` | 만료 공유 일일 정리 (7일 유예) |

정책 노브(슬러그 충돌 / 만료 페이지 / 조회수 필터)는 `src/lib/policy.ts`.

---

Author: Yohan Koo (CMDSPACE) · https://cmdspace.work
