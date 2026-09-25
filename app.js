let currentSession = JSON.parse(localStorage.getItem('current_session')) || null;
let unsubscribeSnapshot = null;
let authMode = 'login'; // 'login' أو 'signup'

const onboardingScreen = document.getElementById('onboarding-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const onboardingForm = document.getElementById('onboarding-form');
const logoutBtn = document.getElementById('logout-btn');

window.addEventListener('DOMContentLoaded', () => {
  if (currentSession && window.db) {
    showDashboard(currentSession.wristband);
  }
});

// دالة التبديل بين واجهة تسجيل الدخول وحساب جديد
window.switchMode = function(mode) {
  authMode = mode;
  const title = document.getElementById('form-title');
  const desc = document.getElementById('form-desc');
  const nameContainer = document.getElementById('name-field-container');
  const photoContainer = document.getElementById('photo-field-container');
  const submitBtn = document.getElementById('submit-btn');
  const tabLogin = document.getElementById('tab-login');
  const tabSignup = document.getElementById('tab-signup');

  if (mode === 'login') {
    title.textContent = "تسجيل دخول طاقم المهمة";
    desc.textContent = "أدخل رقم السوار الخاص بك للمتابعة";
    nameContainer.classList.add('hidden');
    photoContainer.classList.add('hidden');
    document.getElementById('astronaut-name').removeAttribute('required');
    submitBtn.textContent = "دخول لوحة القيادة";
    
    tabLogin.className = "flex-1 py-2 rounded-xl font-bold bg-cyan-600 text-white transition-all cursor-pointer";
    tabSignup.className = "flex-1 py-2 rounded-xl text-slate-400 transition-all cursor-pointer";
  } else {
    title.textContent = "إنشاء حساب سوار جديد";
    desc.textContent = "سجل بيانات السوار والرائد لأول مرة";
    nameContainer.classList.remove('hidden');
    photoContainer.classList.remove('hidden');
    document.getElementById('astronaut-name').setAttribute('required', 'true');
    submitBtn.textContent = "إنشاء الحساب والبدء";

    tabSignup.className = "flex-1 py-2 rounded-xl font-bold bg-cyan-600 text-white transition-all cursor-pointer";
    tabLogin.className = "flex-1 py-2 rounded-xl text-slate-400 transition-all cursor-pointer";
  }
}

onboardingForm.onsubmit = async (e) => {
  e.preventDefault();
  const wristband = document.getElementById('wristband-id').value.trim();
  const { doc, getDoc, setDoc } = window.firebaseModules;
  const docRef = doc(window.db, "astronauts", wristband);
  const docSnap = await getDoc(docRef);

  if (authMode === 'login') {
    // حالة تسجيل الدخول: لازم السوار يكون مسجل من قبل
    if (!docSnap.exists()) {
      alert("❌ رقم السوار غير مسجل في النظام! يرجى إنشاء حساب جديد أولاً.");
      return;
    }
    proceedToSession(wristband);
  } else {
    // حالة إنشاء حساب جديد: التحقق العكسي (إذا كان السوار موجود مسبقاً)
    if (docSnap.exists()) {
      alert("⚠️ عذراً، رقم السوار هذا مسجل مسبقاً في النظام! لا يمكن إنشاء حساب جديد بنفس الرقم. يرجى الانتقال إلى تسجيل الدخول.");
      switchMode('login'); // ينقله تلقائياً لوضع تسجيل الدخول
      return;
    }

    const name = document.getElementById('astronaut-name').value.trim();
    const photoInput = document.getElementById('astronaut-photo');
    let photoUrl = 'https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?w=150&auto=format&fit=crop&q=80';

    if (photoInput.files && photoInput.files[0]) {
      const reader = new FileReader();
      reader.onload = async function(uploadEvent) {
        photoUrl = uploadEvent.target.result;
        await createNewAstronaut(docRef, name, wristband, photoUrl);
      };
      reader.readAsDataURL(photoInput.files[0]);
    } else {
      await createNewAstronaut(docRef, name, wristband, photoUrl);
    }
  }
};

async function createNewAstronaut(docRef, name, wristband, photoUrl) {
  const { setDoc } = window.firebaseModules;
  await setDoc(docRef, {
    name: name,
    wristband: wristband,
    photoUrl: photoUrl,
    metrics: {
      heartRate: { label: 'نبض القلب (HR)', unit: 'BPM', minNorm: 60, maxNorm: 100, val: 72 },
      spo2: { label: 'تشبع الأكسجين (SpO2)', unit: '%', minNorm: 95, maxNorm: 100, val: 98 },
      bpSys: { label: 'الضغط الانقباضي (BP Sys)', unit: 'mmHg', minNorm: 90, maxNorm: 130, val: 120 },
      glucose: { label: 'سكر الدم (Glucose)', unit: 'mg/dL', minNorm: 70, maxNorm: 140, val: 100 },
      bodyTemp: { label: 'حرارة الجسم (Temp)', unit: '°C', minNorm: 36.5, maxNorm: 37.5, val: 37.0 },
      boneTScore: { label: 'كثافة العظام (Bone T-Score)', unit: 'Score', minNorm: -1.0, maxNorm: 1.5, val: 0.2 }
    }
  });

  // رسالة نجاح، مسح النموذج، والانتقال لواجهة تسجيل الدخول
  alert("✅ تم إنشاء الحساب بنجاح! يرجى تسجيل الدخول برقم السوار الآن.");
  document.getElementById('onboarding-form').reset();
  switchMode('login');
}

function proceedToSession(wristband) {
  currentSession = { wristband };
  localStorage.setItem('current_session', JSON.stringify(currentSession));
  showDashboard(wristband);
}

function showDashboard(wristband) {
  onboardingScreen.classList.add('hidden');
  dashboardScreen.classList.remove('hidden');

  const { doc, onSnapshot, setDoc, getDoc } = window.firebaseModules;
  const docRef = doc(window.db, "astronauts", wristband);

  unsubscribeSnapshot = onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      document.getElementById('db-name').textContent = data.name;
      document.getElementById('db-wristband').textContent = data.wristband;
      document.getElementById('db-photo').src = data.photoUrl;
      renderMetrics(data.metrics);
      checkProtocols(data.metrics);
    }
  });

  if (!window.simulationInterval) {
    window.simulationInterval = setInterval(async () => {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        let metrics = snap.data().metrics;
        metrics.heartRate.val = Math.max(50, Math.min(140, metrics.heartRate.val + (Math.floor(Math.random() * 7) - 3)));
        metrics.spo2.val = Math.max(88, Math.min(100, metrics.spo2.val + (Math.random() > 0.8 ? (Math.random() > 0.5 ? 1 : -1) : 0)));
        metrics.bodyTemp.val = Math.max(36.0, Math.min(38.8, Number((metrics.bodyTemp.val + (Math.random() * 0.2 - 0.1)).toFixed(1))));

        await setDoc(docRef, { metrics }, { merge: true });
      }
    }, 3000);
  }
}

logoutBtn.onclick = () => {
  if (unsubscribeSnapshot) unsubscribeSnapshot();
  clearInterval(window.simulationInterval);
  window.simulationInterval = null;
  localStorage.removeItem('current_session');
  location.reload();
};

function renderMetrics(metrics) {
  const grid = document.getElementById('metrics-grid');
  grid.innerHTML = Object.keys(metrics).map(key => {
    const m = metrics[key];
    const isCritical = m.val < m.minNorm || m.val > m.maxNorm;
    const statusText = isCritical ? 'غير طبيعي (Alert)' : 'طبيعي (Nominal)';
    const statusClass = isCritical ? 'text-red-400 bg-red-500/15 border-red-500/40 animate-pulse' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';

    return `
      <div class="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 space-y-3">
        <div class="flex justify-between items-start">
          <div>
            <span class="text-[10px] text-slate-400 block">${m.label}</span>
            <span class="text-lg font-bold font-mono text-white mt-0.5 block">${m.val} <span class="text-xs text-slate-500 font-normal">${m.unit}</span></span>
          </div>
          <span class="text-[10px] font-mono px-2.5 py-1 rounded-full border ${statusClass}">${statusText}</span>
        </div>
        <div class="text-[10px] text-slate-500 flex justify-between font-mono pt-2 border-t border-slate-900">
          <span>النطاق الآمن:</span>
          <span>${m.minNorm} - ${m.maxNorm} ${m.unit}</span>
        </div>
      </div>
    `;
  }).join('');
}

function checkProtocols(metrics) {
  const container = document.getElementById('protocol-content');
  const globalStatus = document.getElementById('db-global-status');

  let alerts = [];
  if (metrics.spo2.val < 93) alerts.push({ title: 'اختناق / نقص أكسجين', physio: 'رفع نسبة الأكسجين وربط القناع 100%.', medical: 'أسيتازولاميد (Diamox).' });
  if (metrics.heartRate.val > 120) alerts.push({ title: 'تسارع حاد في النبض', physio: 'إيقاف الحركة والاستلقاء.', medical: 'حاصرات بيتا (Metoprolol).' });
  if (metrics.bodyTemp.val > 38.0) alerts.push({ title: 'ارتفاع الحرارة', physio: 'تفعيل التبريد المحلي.', medical: 'باراسيتامول (500mg).' });

  if (alerts.length > 0) {
    globalStatus.textContent = 'CRITICAL ALERT (تحذير طارئ)';
    globalStatus.className = 'text-xs font-mono font-bold text-red-400 animate-pulse';
    container.innerHTML = alerts.map(a => `
      <div class="p-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 space-y-1">
        <span class="font-bold block">⚠️ ${a.title}</span>
        <p class="text-[11px] text-slate-300"><strong>فسيولوجياً:</strong> ${a.physio}</p>
        <p class="text-[11px] text-amber-300"><strong>طبياً:</strong> ${a.medical}</p>
      </div>
    `).join('');
  } else {
    globalStatus.textContent = 'NOMINAL (طبيعي)';
    globalStatus.className = 'text-xs font-mono font-bold text-emerald-400';
    container.innerHTML = `<div class="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400"><span class="font-bold block mb-1">جميع العمليات ضمن النطاق الآمن</span>المؤشرات مستقرة تماماً.</div>`;
  }
}