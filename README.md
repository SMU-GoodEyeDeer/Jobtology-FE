# Jobtology Frontend

The Jobtology frontend is built with React, TypeScript, and Vite.

## Development

```sh
npm install
npm run dev
```

## Checks

```sh
npm test
npm run build
```
## 프로젝트 구조                                                                                                                                  
                                                                                                                                                       
```
  src/
    assets/        -> 이미지, 아이콘 등 정적 파일
	                                                                                                  
    components/    -> 공용 컴포넌트                                                                                                                    
      logo.svg     -> 대표로고
    pages/                                                                                                                                             
      Onboarding/                                                                                                                                      
        Onboarding.tsx   -> 온보딩 (최초 화면)                                                                                                         
        Onboarding.css
App.css        -> 전역 스타일 (CSS 변수, body 등)                                                                                                  
    App.tsx        -> 라우터                                                                                                                           
    main.tsx       -> 앱 진입점         
```

- **main** : 배포 브랜치. CI/CD가 연결되어 있어 머지되면 테스트 후 자동 배포됩니다.
- **작업 브랜치** : `main`에서 분기, 작업 완료 후 `main`으로 PR/머지 (머지 전 테스트 통과 필수)

### 브랜치 이름 구조

```
type/MMDD_작업내용_순번
```

- `type`은 Commit Type Rule과 동일한 태그를 사용합니다.
- `MMDD`는 브랜치를 딴 날짜입니다.
- 같은 날 같은 작업을 이어서 할 경우에만 마지막에 순번(`_1`, `_2`, ...)을 붙입니다.

| 예시 | 설명 |
| --- | --- |
| `feat/0418_login_page` | 4/18, 로그인 페이지 기능 추가 |
| `fix/0426_header_overflow` | 4/26, 헤더 overflow 버그 수정 |
| `refact/0707_api_1` | 7/7, API 리팩토링 1차 |
| `refact/0720_api_2` | 7/20, API 리팩토링 2차 (이어서 작업) |

## Commit 메세지 구조

기본적인 커밋 메시지 구조는 제목, 본문, 꼬리말 세 가지 파트로 나누고, 각 파트는 빈 줄을 두어 구분합니다.

## Commit Type Rule

- 태그는 영어로 소문자로 작성합니다.
- 태그 뒤에는 ": "을 붙입니다. (콜론 뒤에만 한 칸 띄움)

| Commit Type | Description |
| --- | --- |
| **feat** | 새로운 기능 추가 |
| **fix** | 버그 수정 |
| **design** | CSS 등 사용자 UI 디자인 변경 |
| **refact** | 코드 리팩토링, 포맷팅, 파일/폴더 변경·이동·삭제 등 |
| **test** | 테스트 추가/수정 |
| **chore** | 빌드, 패키지, 에셋 추가, 설정 등 그 외 변경 |
