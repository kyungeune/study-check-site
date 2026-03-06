// ============================================================
//  ⚙️  Supabase 설정 — 아래 두 값을 본인 것으로 교체하세요!
// ============================================================
const SUPABASE_URL = 'https://your-project-id.supabase.co';   // ← 교체
const SUPABASE_ANON_KEY = 'your-anon-key-here';               // ← 교체
// ============================================================

// Supabase 클라이언트 초기화
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ────────────────────────────────────────────────────────────
// 날짜 헬퍼
// ────────────────────────────────────────────────────────────

/** "YYYY-MM-DD" 형식으로 오늘 날짜 반환 */
function getTodayString() {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** "2025년 6월 18일 (수)" 형식으로 오늘 날짜 반환 */
function getTodayDisplayString() {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth() + 1;
  const d = today.getDate();
  const day = days[today.getDay()];
  return `${y}년 ${m}월 ${d}일 (${day})`;
}

// ────────────────────────────────────────────────────────────
// 페이지 초기화
// ────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  // 오늘 날짜 표시
  document.getElementById('todayDate').textContent = getTodayDisplayString();

  // 통계 로드
  loadStats();

  // 체크박스 변경 시 카드 시각 반영 (CSS :has()가 지원 안 되는 브라우저 대비)
  syncCheckCards();
});

// ────────────────────────────────────────────────────────────
// 체크박스 ↔ 카드 동기화 (CSS :has() 미지원 브라우저 보완)
// ────────────────────────────────────────────────────────────
function syncCheckCards() {
  const morningCheck = document.getElementById('morningCheck');
  const eveningCheck = document.getElementById('eveningCheck');
  // 이미 CSS :has()로 처리하므로 이벤트만 연결
  morningCheck.addEventListener('change', () => {});
  eveningCheck.addEventListener('change', () => {});
}

// ────────────────────────────────────────────────────────────
// 참여 저장
// ────────────────────────────────────────────────────────────
async function saveAttendance() {
  const name    = document.getElementById('nameSelect').value.trim();
  const morning = document.getElementById('morningCheck').checked;
  const evening = document.getElementById('eveningCheck').checked;
  const date    = getTodayString();

  // 유효성 검사
  if (!name) {
    showMessage('이름을 선택해주세요. 😊', 'error');
    return;
  }
  if (!morning && !evening) {
    showMessage('아침 또는 저녁 스터디 중 하나 이상을 선택해주세요. 📚', 'error');
    return;
  }

  // 버튼 로딩 상태
  setLoading(true);

  try {
    // 같은 날짜에 이미 기록이 있는지 확인
    const { data: existing, error: selectError } = await db
      .from('attendance')
      .select('id')
      .eq('name', name)
      .eq('date', date)
      .maybeSingle();

    if (selectError) throw selectError;

    if (existing) {
      // 기존 기록이 있으면 UPDATE
      const { error: updateError } = await db
        .from('attendance')
        .update({ morning, evening })
        .eq('id', existing.id);

      if (updateError) throw updateError;
      showMessage(`✅ ${name}님의 참여 정보가 업데이트되었습니다!`, 'success');
    } else {
      // 없으면 INSERT
      const { error: insertError } = await db
        .from('attendance')
        .insert([{ name, date, morning, evening }]);

      if (insertError) throw insertError;
      showMessage(`🎉 ${name}님의 참여가 저장되었습니다!`, 'success');
    }

    // 저장 후 통계 갱신
    await loadStats();

  } catch (err) {
    console.error('저장 오류:', err);
    showMessage('❌ 저장 중 오류가 발생했습니다. 콘솔을 확인해주세요.', 'error');
  } finally {
    setLoading(false);
  }
}

// ────────────────────────────────────────────────────────────
// 통계 로드
// ────────────────────────────────────────────────────────────
async function loadStats() {
  const date = getTodayString();

  try {
    // 오늘 날짜의 모든 출석 데이터를 가져옴
    const { data, error } = await db
      .from('attendance')
      .select('name, morning, evening')
      .eq('date', date);

    if (error) throw error;

    // 아침 / 저녁 참여자 분류
    const morningAttendees = (data || []).filter(row => row.morning).map(row => row.name);
    const eveningAttendees = (data || []).filter(row => row.evening).map(row => row.name);

    // 카운트 표시
    document.getElementById('morningCount').textContent = morningAttendees.length;
    document.getElementById('eveningCount').textContent = eveningAttendees.length;

    // 참여자 이름 목록 표시
    renderAttendeeList(morningAttendees, eveningAttendees);

  } catch (err) {
    console.error('통계 로딩 오류:', err);
    document.getElementById('morningCount').textContent = '?';
    document.getElementById('eveningCount').textContent = '?';
  }
}

// ────────────────────────────────────────────────────────────
// 참여자 이름 목록 렌더링
// ────────────────────────────────────────────────────────────
function renderAttendeeList(morningNames, eveningNames) {
  const listSection = document.getElementById('attendeeList');
  const morningListEl = document.getElementById('morningList');
  const eveningListEl = document.getElementById('eveningList');

  // 아침 참여자 태그
  morningListEl.innerHTML = morningNames.length
    ? morningNames.map(n => `<span class="attendee-tag morning-tag">${n}</span>`).join('')
    : '<span class="no-attendee">아직 없습니다</span>';

  // 저녁 참여자 태그
  eveningListEl.innerHTML = eveningNames.length
    ? eveningNames.map(n => `<span class="attendee-tag evening-tag">${n}</span>`).join('')
    : '<span class="no-attendee">아직 없습니다</span>';

  // 목록 섹션 표시
  listSection.classList.remove('hidden');
}

// ────────────────────────────────────────────────────────────
// UI 헬퍼
// ────────────────────────────────────────────────────────────

/** 메시지 표시 */
function showMessage(text, type = 'success') {
  const el = document.getElementById('message');
  el.textContent = text;
  el.className = `message ${type}`;
  el.classList.remove('hidden');

  // 4초 후 자동 숨김
  clearTimeout(el._timer);
  el._timer = setTimeout(() => {
    el.classList.add('hidden');
  }, 4000);
}

/** 버튼 로딩 상태 토글 */
function setLoading(isLoading) {
  const btn     = document.getElementById('saveBtn');
  const text    = document.getElementById('btnText');
  const spinner = document.getElementById('btnSpinner');

  btn.disabled = isLoading;
  if (isLoading) {
    text.classList.add('hidden');
    spinner.classList.remove('hidden');
  } else {
    text.classList.remove('hidden');
    spinner.classList.add('hidden');
  }
}