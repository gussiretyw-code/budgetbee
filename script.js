document.addEventListener('DOMContentLoaded', () => {

    // ===== ГЛОБАЛЬНЫЙ ПЕРЕХВАТ ОШИБОК (чтобы видеть проблему, а не белый экран) =====
    window.addEventListener('error', (e) => {
        console.error('JS Error:', e.message, e.filename, e.lineno);
        document.body.insertAdjacentHTML('afterbegin',
            `<div style="position:fixed;top:0;left:0;right:0;background:#ef4444;color:#fff;padding:8px 12px;z-index:9999;font:12px monospace;border-radius:0 0 8px 8px">
                Ошибка JS: ${e.message} (${e.filename}:${e.lineno})
            </div>`);
    });

    const screens = document.querySelectorAll('.screen');
    let currentUser = null;
    let transactions = [];
    let goals = [];
    let expenseByCategory = {};

    // ===== БЕЗОПАСНЫЕ ОБЁРТКИ localStorage =====
    function safeGet(key, fallback = null) {
        try { return localStorage.getItem(key); } catch { return fallback; }
    }
    function safeSet(key, value) {
        try { localStorage.setItem(key, value); } catch (e) { console.warn('localStorage error', e); }
    }
    function getUsers() {
        try { return JSON.parse(safeGet('users') || '[]'); } catch { return []; }
    }
    function setUsers(users) { safeSet('users', JSON.stringify(users)); }

    // ===== ПЕРЕКЛЮЧЕНИЕ ЭКРАНОВ =====
    function switchScreen(targetId) {
        screens.forEach(s => s.classList.remove('active'));
        const target = document.getElementById(targetId);
        if (target) target.classList.add('active');
        else console.warn('Экран не найден:', targetId);
    }

    // 👇 ПРИНУДИТЕЛЬНО ПОКАЗЫВАЕМ СТАРТОВЫЙ ЭКРАН
    switchScreen('screen-onboarding');

    document.querySelectorAll('[data-target]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            const t = el.getAttribute('data-target');
            if (t) switchScreen(t);
        });
    });

    // ===== ВЕРХНЯЯ ПАНЕЛЬ =====
    document.getElementById('bellBtn')?.addEventListener('click', () => switchScreen('screen-notifications'));

    const toggleBalance = document.getElementById('toggleBalance');
    const balanceAmountEl = document.getElementById('balanceAmount');
    let balanceHidden = false;
    toggleBalance?.addEventListener('click', () => {
        balanceHidden = !balanceHidden;
        balanceAmountEl?.classList.toggle('hidden', balanceHidden);
        toggleBalance.classList.toggle('fa-eye', !balanceHidden);
        toggleBalance.classList.toggle('fa-eye-slash', balanceHidden);
    });

    // ===== ФОРМА ТРАНЗАКЦИИ =====
    document.querySelectorAll('.type-toggle button').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.type-toggle button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    document.querySelectorAll('.cat-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.cat-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
        });
    });

    const amountInput = document.getElementById('amountInput');
    amountInput?.addEventListener('focus', () => { amountInput.value = amountInput.value.replace(' BYN', ''); });
    amountInput?.addEventListener('blur', () => {
        const v = amountInput.value.replace(/[^\d.,]/g, '');
        if (v) amountInput.value = v + ' BYN';
    });

    const dateInput = document.getElementById('dateInput');
    if (dateInput) {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        dateInput.value = now.toISOString().slice(0, 16);
    }

    // ===== ХЕЛПЕРЫ =====
    function formatNumber(num) {
        return Math.round(num).toLocaleString('ru-RU').replace(/,/g, ' ');
    }

    const categoryColors = {
        'Еда': '#facc15', 'Транспорт': '#3b82f6', 'Развлечения': '#a855f7',
        'Жильё': '#22c55e', 'Здоровье': '#ef4444', 'Одежда': '#a855f7',
        'Образование': '#3b82f6', 'Покупки': '#a855f7', 'Другое': '#f59e0b'
    };

    const categoryIcons = {
        'Еда': { icon: 'fa-utensils', color: 'red' },
        'Транспорт': { icon: 'fa-bus', color: 'blue' },
        'Развлечения': { icon: 'fa-gamepad', color: 'purple' },
        'Жильё': { icon: 'fa-home', color: 'green' },
        'Здоровье': { icon: 'fa-heartbeat', color: 'red' },
        'Одежда': { icon: 'fa-tshirt', color: 'purple' },
        'Образование': { icon: 'fa-graduation-cap', color: 'blue' },
        'Покупки': { icon: 'fa-shopping-bag', color: 'purple' },
        'Другое': { icon: 'fa-ellipsis-h', color: 'yellow' },
        'Продукты': { icon: 'fa-shopping-basket', color: 'red' },
        'Кино': { icon: 'fa-film', color: 'purple' },
        'Кофе': { icon: 'fa-coffee', color: 'yellow' },
        'Зарплата': { icon: 'fa-wallet', color: 'green' },
        'Ресторан': { icon: 'fa-utensils', color: 'red' },
        'Заправка': { icon: 'fa-gas-pump', color: 'blue' }
    };

    // ===== РЕНДЕР ТРАНЗАКЦИЙ =====
    function createTransactionElement(t) {
        const div = document.createElement('div');
        div.className = 'transaction-item';
        const info = categoryIcons[t.category] || { icon: 'fa-ellipsis-h', color: 'yellow' };
        const cls = t.type === 'income' ? 'amount amount-positive' : 'amount';
        const sign = t.type === 'income' ? '+' : '-';
        div.innerHTML = `
            <div class="icon-box ${info.color}"><i class="fas ${info.icon}"></i></div>
            <div class="info"><span>${t.category}</span><span class="date">${t.date}</span></div>
            <div class="${cls}">${sign}${formatNumber(t.amount)} BYN</div>
        `;
        return div;
    }

    function renderRecent() {
        const list = document.getElementById('transactionList');
        if (!list) return;
        list.innerHTML = '';
        transactions.slice(0, 8).forEach(t => list.appendChild(createTransactionElement(t)));
    }

    function renderAll() {
        const list = document.getElementById('allTransactionList');
        if (!list) return;
        list.innerHTML = '';
        transactions.forEach(t => list.appendChild(createTransactionElement(t)));
    }

    // ===== ДИАГРАММА =====
    function updateDonutChart() {
        const cats = Object.keys(expenseByCategory);
        const donut = document.getElementById('donutChart');
        const legend = document.getElementById('chartLegend');
        if (!donut || !legend) return;
        if (cats.length === 0) {
            donut.style.background = '#eee';
            legend.innerHTML = '';
            return;
        }
        const total = Object.values(expenseByCategory).reduce((a, b) => a + b, 0) || 1;
        let grad = [], cur = 0;
        cats.forEach(cat => {
            const p = (expenseByCategory[cat] / total) * 100;
            const c = categoryColors[cat] || '#f59e0b';
            grad.push(`${c} ${cur}% ${cur + p}%`);
            cur += p;
        });
        donut.style.background = `conic-gradient(${grad.join(', ')})`;
        legend.innerHTML = '';
        cats.forEach(cat => {
            const p = Math.round((expenseByCategory[cat] / total) * 100);
            const c = categoryColors[cat] || '#f59e0b';
            const d = document.createElement('div');
            d.className = 'legend-item';
            d.innerHTML = `<span class="dot" style="background-color:${c};"></span> ${cat} <span class="value">${formatNumber(expenseByCategory[cat])} BYN</span> <span class="percent">${p}%</span>`;
            legend.appendChild(d);
        });
    }

    function updateDashboard() {
        if (!currentUser) return;
        const bal = document.getElementById('balanceAmount');
        const inc = document.getElementById('totalIncome');
        const exp = document.getElementById('totalExpense');
        if (bal) bal.textContent = formatNumber(currentUser.balance) + ' BYN';
        if (inc) inc.textContent = formatNumber(currentUser.totalIncome) + ' BYN';
        if (exp) exp.textContent = formatNumber(currentUser.totalExpense) + ' BYN';
        updateDonutChart();
    }

    // ===== ЦЕЛИ =====
    function renderGoals() {
        const list = document.getElementById('goalsList');
        if (!list) return;
        list.innerHTML = '';
        if (goals.length === 0) {
            list.innerHTML = '<div style="padding:40px 20px;text-align:center;color:#aaa;font-size:13px">Пока нет целей.<br>Нажмите «+ Новая цель»</div>';
            return;
        }
        goals.forEach(g => {
            const p = g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0;
            const card = document.createElement('div');
            card.className = 'goal-card';
            card.innerHTML = `
                <div class="goal-top">
                    <div class="goal-icon">${g.icon}</div>
                    <div class="goal-info"><h4>${g.name}</h4><p>${formatNumber(g.target)} BYN</p><p class="sub">Накоплено: ${formatNumber(g.saved)} BYN</p></div>
                    <i class="fas fa-ellipsis-h" data-goal-id="${g.id}" style="cursor:pointer;"></i>
                </div>
                <div class="progress-bar"><div class="progress" style="width: ${p}%;"></div></div>
                <div class="goal-footer"><span>📅 До: ${g.date}</span><span>${p}%</span></div>
                <p class="goal-desc">${g.desc || ''}</p>
            `;
            list.appendChild(card);
        });
    }

    // ===== СОХРАНЕНИЕ =====
    function saveToStorage() {
        if (!currentUser) return;
        const users = getUsers();
        const idx = users.findIndex(u => u.id === currentUser.id);
        if (idx !== -1) {
            users[idx] = {
                ...users[idx],
                balance: currentUser.balance,
                totalIncome: currentUser.totalIncome,
                totalExpense: currentUser.totalExpense,
                transactions,
                goals,
                expenseByCategory
            };
            setUsers(users);
        }
    }

    function setUserUI(user) {
        const displayName = (user.name && user.name.includes('@'))
            ? user.name.split('@')[0]
            : (user.name || 'Пользователь');
        const pn = document.getElementById('profileName');
        const pe = document.getElementById('profileEmail');
        const dg = document.getElementById('dashboardGreeting');
        if (pn) pn.textContent = displayName;
        if (pe) pe.textContent = user.email;
        if (dg) dg.textContent = `Привет, ${displayName}!`;
    }

    function loadUserData(user) {
        currentUser = user;
        transactions = user.transactions || [];
        goals = user.goals || [];
        expenseByCategory = user.expenseByCategory || {};
        setUserUI(user);
        renderRecent();
        renderAll();
        renderGoals();
        updateDashboard();
    }

    // ===== РЕГИСТРАЦИЯ =====
    document.getElementById('registerBtn')?.addEventListener('click', () => {
        const name = document.getElementById('regName').value.trim();
        const email = document.getElementById('regEmail').value.trim().toLowerCase();
        const p1 = document.getElementById('regPassword').value;
        const p2 = document.getElementById('regPassword2').value;
        const agree = document.getElementById('agreeTerms').checked;
        const err = document.getElementById('regError');
        err.textContent = '';

        if (!name) return err.textContent = 'Введите имя';
        if (!email || !email.includes('@')) return err.textContent = 'Введите корректный email';
        if (p1.length < 6) return err.textContent = 'Пароль минимум 6 символов';
        if (p1 !== p2) return err.textContent = 'Пароли не совпадают';
        if (!agree) return err.textContent = 'Согласитесь с условиями';

        const users = getUsers();
        if (users.find(u => u.email === email)) {
            return err.textContent = 'Email уже зарегистрирован';
        }

        const newUser = {
            id: Date.now().toString(),
            name, email, password: p1,
            balance: 4250, totalIncome: 2800, totalExpense: 1990,
            transactions: [
                { id: '1', category: 'Продукты', date: '12 янв', amount: 45, type: 'expense' },
                { id: '2', category: 'Транспорт', date: '11 янв', amount: 3, type: 'expense' },
                { id: '3', category: 'Кино', date: '10 янв', amount: 15, type: 'expense' },
                { id: '4', category: 'Кофе', date: '9 янв', amount: 8, type: 'expense' },
                { id: '5', category: 'Зарплата', date: '8 янв', amount: 1200, type: 'income' }
            ],
            goals: [
                { id: '1', name: 'Отпуск', target: 4000, saved: 1600, date: '1 июл. 2025', icon: '🌴', desc: 'Море, солнце и новые впечатления!' },
                { id: '2', name: 'Новый телефон', target: 2500, saved: 1000, date: '15 авг. 2025', icon: '📱', desc: 'Новый телефон — новые возможности!' },
                { id: '3', name: 'Подушка безопасности', target: 3000, saved: 2100, date: '31 дек. 2025', icon: '🛡️', desc: 'Спокойствие — лучшая инвестиция.' },
                { id: '4', name: 'Новый ноутбук', target: 3500, saved: 800, date: '10 сен. 2025', icon: '💻', desc: 'Для работы и учёбы.' }
            ],
            expenseByCategory: { 'Еда': 950, 'Транспорт': 540, 'Развлечения': 450, 'Жильё': 1050 }
        };

        users.push(newUser);
        setUsers(users);
        loadUserData(newUser);
        switchScreen('screen-dashboard');
    });

    // ===== ВХОД =====
    document.getElementById('loginBtn')?.addEventListener('click', () => {
        const email = document.getElementById('loginEmail').value.trim().toLowerCase();
        const pass = document.getElementById('loginPassword').value;
        const err = document.getElementById('loginError');
        err.textContent = '';

        if (!email || !email.includes('@')) return err.textContent = 'Введите корректный email';
        if (pass.length < 6) return err.textContent = 'Пароль минимум 6 символов';

        const users = getUsers();
        const user = users.find(u => u.email === email);
        if (!user) return err.textContent = 'Пользователь не найден. Зарегистрируйтесь.';
        if (user.password !== pass) return err.textContent = 'Неверный пароль';

        loadUserData(user);
        switchScreen('screen-dashboard');
    });

    // ===== СОХРАНЕНИЕ ТРАНЗАКЦИИ =====
    document.getElementById('saveTransaction')?.addEventListener('click', () => {
        if (!currentUser) return alert('Войдите в аккаунт');
        const raw = document.getElementById('amountInput').value.replace(' BYN', '').replace(',', '.').trim();
        const amount = parseFloat(raw) || 0;
        if (amount <= 0) return alert('Введите сумму > 0');

        const note = document.getElementById('noteInput').value.trim();
        const dv = document.getElementById('dateInput').value;
        const cat = document.querySelector('.cat-item.active').getAttribute('data-cat');
        const type = document.querySelector('.type-toggle button.active').getAttribute('data-type');
        const date = dv ? new Date(dv).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

        const transaction = { id: Date.now().toString(), category: note || cat, date, amount, type };
        transactions.unshift(transaction);

        if (type === 'income') {
            currentUser.totalIncome += amount;
            currentUser.balance += amount;
        } else {
            currentUser.totalExpense += amount;
            currentUser.balance -= amount;
            if (expenseByCategory[cat] !== undefined) expenseByCategory[cat] += amount;
            else expenseByCategory[cat] = amount;
        }

        saveToStorage();
        renderRecent(); renderAll(); updateDashboard();

        document.getElementById('amountInput').value = '50 BYN';
        document.getElementById('noteInput').value = '';
        switchScreen('screen-dashboard');
    });

    document.getElementById('viewAllTransactions')?.addEventListener('click', (e) => {
        e.preventDefault();
        renderAll();
        switchScreen('screen-all-transactions');
    });

    // ===== ЦЕЛИ =====
    document.getElementById('addGoalBtn')?.addEventListener('click', () => switchScreen('screen-new-goal'));

    document.getElementById('saveGoal')?.addEventListener('click', () => {
        if (!currentUser) return alert('Войдите в аккаунт');
        const name = document.getElementById('goalName').value || 'Без названия';
        const target = parseFloat(document.getElementById('goalTarget').value) || 0;
        const saved = parseFloat(document.getElementById('goalSaved').value) || 0;
        const date = document.getElementById('goalDate').value || '2025-12-31';
        const icon = document.getElementById('goalIcon').value || '🎯';
        const desc = document.getElementById('goalDesc').value || '';

        const goal = { id: Date.now().toString(), name, target, saved, date, icon, desc };
        goals.push(goal);
        saveToStorage();
        renderGoals();

        document.getElementById('goalName').value = '';
        document.getElementById('goalTarget').value = '';
        document.getElementById('goalSaved').value = '';
        document.getElementById('goalDesc').value = '';
        switchScreen('screen-goals');
    });

    // ===== НАСТРОЙКИ =====
    document.getElementById('settingsBtn')?.addEventListener('click', () => switchScreen('screen-settings'));
    document.getElementById('profileSettingsBtn')?.addEventListener('click', () => switchScreen('screen-settings'));
    document.getElementById('settingsLogout')?.addEventListener('click', () => {
        currentUser = null; transactions = []; goals = []; expenseByCategory = {};
        switchScreen('screen-onboarding');
    });

    document.getElementById('openProfile')?.addEventListener('click', () => switchScreen('screen-profile'));
    document.getElementById('openNotifications')?.addEventListener('click', () => switchScreen('screen-notifications'));
    document.getElementById('openSecurity')?.addEventListener('click', () => switchScreen('screen-security'));
    document.getElementById('openTheme')?.addEventListener('click', () => switchScreen('screen-theme'));
    document.getElementById('openLanguage')?.addEventListener('click', () => switchScreen('screen-language'));
    document.getElementById('openHelp')?.addEventListener('click', () => switchScreen('screen-help'));

    document.getElementById('openChangePassword')?.addEventListener('click', () => switchScreen('screen-change-password'));
    document.getElementById('openFingerprint')?.addEventListener('click', () => switchScreen('screen-fingerprint'));
    document.getElementById('open2FA')?.addEventListener('click', () => switchScreen('screen-2fa'));
    document.getElementById('openHistory')?.addEventListener('click', () => switchScreen('screen-history'));
    document.getElementById('openDevices')?.addEventListener('click', () => switchScreen('screen-devices'));

    document.getElementById('openFAQ')?.addEventListener('click', () => switchScreen('screen-faq'));
    document.getElementById('openManual')?.addEventListener('click', () => switchScreen('screen-manual'));
    document.getElementById('openSupportChat')?.addEventListener('click', () => switchScreen('screen-chat'));
    document.getElementById('openVideo')?.addEventListener('click', () => switchScreen('screen-video'));
    document.getElementById('openAbout')?.addEventListener('click', () => switchScreen('screen-about'));

    document.getElementById('openEmail')?.addEventListener('click', () => { window.location.href = 'mailto:support@budgetbee.by'; });
    document.getElementById('openPhone')?.addEventListener('click', () => { window.location.href = 'tel:+375290000000'; });

    // ===== СМЕНА ПАРОЛЯ =====
    document.getElementById('savePasswordBtn')?.addEventListener('click', () => {
        const oldP = document.getElementById('oldPassword').value;
        const newP = document.getElementById('newPassword').value;
        const newP2 = document.getElementById('newPassword2').value;
        const err = document.getElementById('passwordError');
        err.textContent = '';
        err.style.color = '#ef4444';

        if (!currentUser) return err.textContent = 'Войдите в аккаунт';
        if (oldP !== currentUser.password) return err.textContent = 'Неверный текущий пароль';
        if (newP.length < 6) return err.textContent = 'Новый пароль минимум 6 символов';
        if (newP !== newP2) return err.textContent = 'Пароли не совпадают';
        if (newP === oldP) return err.textContent = 'Новый должен отличаться';

        currentUser.password = newP;
        const users = getUsers();
        const idx = users.findIndex(u => u.id === currentUser.id);
        if (idx !== -1) {
            users[idx].password = newP;
            setUsers(users);
        }

        err.style.color = '#22c55e';
        err.textContent = 'Пароль изменён ✓';
        document.getElementById('oldPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('newPassword2').value = '';
        setTimeout(() => {
            err.style.color = '#ef4444';
            err.textContent = '';
            switchScreen('screen-security');
        }, 1500);
    });

    // ===== ТЕМА =====
    document.querySelectorAll('#screen-theme .theme-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('#screen-theme .theme-option').forEach(o => {
                o.classList.remove('active');
                const ic = o.querySelector('i:last-child');
                if (ic) ic.style.visibility = 'hidden';
            });
            opt.classList.add('active');
            const ic = opt.querySelector('i:last-child');
            if (ic) ic.style.visibility = 'visible';
            applyTheme(opt.getAttribute('data-theme'));
            safeSet('theme', opt.getAttribute('data-theme'));
        });
    });

    function applyTheme(theme) {
        if (theme === 'dark') document.body.classList.add('dark');
        else if (theme === 'light') document.body.classList.remove('dark');
        else {
            const d = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.body.classList.toggle('dark', d);
        }
    }

    // ===== ЯЗЫК =====
    const translations = {
        ru: { greeting: 'Привет', goals: 'Мои цели', newGoal: '+ Новая цель', main: 'Главная', transactions: 'Транзакции', profile: 'Профиль', balance: 'Общий баланс', income: 'Доходы', expense: 'Расходы', recent: 'Последние транзакции' },
        en: { greeting: 'Hello', goals: 'My goals', newGoal: '+ New goal', main: 'Home', transactions: 'Transactions', profile: 'Profile', balance: 'Total balance', income: 'Income', expense: 'Expenses', recent: 'Recent transactions' },
        by: { greeting: 'Прывітанне', goals: 'Мае мэты', newGoal: '+ Новая мэта', main: 'Галоўная', transactions: 'Транзакцыі', profile: 'Профіль', balance: 'Агульны баланс', income: 'Даходы', expense: 'Выдаткі', recent: 'Апошнія транзакцыі' }
    };

    function applyLanguage(lang) {
        const t = translations[lang] || translations.ru;
        const name = currentUser?.name || 'Гость';
        const displayName = (name && name.includes('@')) ? name.split('@')[0] : name;
        const map = {
            dashboardGreeting: `${t.greeting}, ${displayName}!`,
            goalsHeader: t.goals,
            addGoalBtn: t.newGoal,
            navMain: t.main,
            navTransactions: t.transactions,
            navGoals: t.goals,
            navProfile: t.profile,
            labelBalance: t.balance,
            labelIncome: t.income,
            labelExpense: t.expense,
            labelRecent: t.recent
        };
        Object.entries(map).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        });
    }

    document.querySelectorAll('#screen-language .theme-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('#screen-language .theme-option').forEach(o => {
                o.classList.remove('active');
                const ic = o.querySelector('i:last-child');
                if (ic) ic.style.visibility = 'hidden';
            });
            opt.classList.add('active');
            const ic = opt.querySelector('i:last-child');
            if (ic) ic.style.visibility = 'visible';
            const lang = opt.getAttribute('data-lang');
            safeSet('lang', lang);
            applyLanguage(lang);
        });
    });

    document.querySelectorAll('#screen-2fa .theme-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('#screen-2fa .theme-option').forEach(o => {
                o.classList.remove('active');
                const ic = o.querySelector('i:last-child');
                if (ic) ic.style.visibility = 'hidden';
            });
            opt.classList.add('active');
            const ic = opt.querySelector('i:last-child');
            if (ic) ic.style.visibility = 'visible';
        });
    });

    // ===== УСТРОЙСТВА =====
    document.querySelectorAll('.device-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            const name = btn.getAttribute('data-device');
            if (confirm(`Удалить устройство "${name}"?`)) btn.closest('.device-card')?.remove();
        });
    });

    // ===== ПОКАЗ ПАРОЛЯ =====
    document.querySelectorAll('.toggle-password').forEach(icon => {
        icon.addEventListener('click', () => {
            const input = document.getElementById(icon.getAttribute('data-target'));
            if (!input) return;
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.replace('fa-eye', 'fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.replace('fa-eye-slash', 'fa-eye');
            }
        });
    });

    // ===== ВИДЕО =====
    document.querySelectorAll('.video-card').forEach(v => {
        v.addEventListener('click', () => {
            const title = v.querySelector('h4')?.textContent || '';
            alert(`▶️ Запуск видео: "${title}"\n\nВ реальном приложении здесь откроется видеоплеер.`);
        });
    });

    // ===== ГРАФИК В ПРОФИЛЕ =====
    const periodTabs = document.querySelectorAll('#periodTabs button');
    const barChart = document.getElementById('barChart');
    const barChartLabels = document.getElementById('barChartLabels');
    const chartData = {
        week: { labels: ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'], values: [30,50,40,70,60,80,45] },
        month: { labels: ['1','5','10','15','20','25','30'], values: [45,60,30,75,55,85,65] },
        year: { labels: ['Янв','Мар','Май','Июл','Сен','Ноя','Дек'], values: [40,55,35,70,60,90,75] }
    };
    function renderChart(period) {
        if (!barChart || !barChartLabels) return;
        const d = chartData[period];
        barChart.innerHTML = '';
        barChartLabels.innerHTML = '';
        d.values.forEach(v => {
            const b = document.createElement('div');
            b.className = 'bar';
            b.style.height = v + '%';
            barChart.appendChild(b);
        });
        d.labels.forEach(l => {
            const s = document.createElement('span');
            s.textContent = l;
            barChartLabels.appendChild(s);
        });
    }
    periodTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            periodTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderChart(tab.getAttribute('data-period'));
        });
    });

    // ===== ЧАТ =====
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const chatSendBtn = document.getElementById('chatSendBtn');
    const chatExportBtn = document.getElementById('chatExportBtn');
    const chatClearBtn = document.getElementById('chatClearBtn');
    const CHAT_KEY = 'budgetbee_chat_history';

    function getWelcomeMessage() {
        return `Здравствуйте! 👋 Я бот поддержки BudgetBee.\n\nВот что я умею:\n\n1️⃣ 💸 Транзакции — как добавить расход или доход\n2️⃣ 🎯 Цели — как создать и отслеживать\n3️⃣ 🔐 Пароль — как сменить пароль\n4️⃣ 🎨 Тема — светлая / тёмная / системная\n5️⃣ 🌐 Язык — русский / English / беларуская\n6️⃣ 💾 Данные — где хранится информация\n7️⃣ 📊 Статистика — неделя / месяц / год\n8️⃣ 🛡️ Безопасность — 2FA, отпечаток, устройства\n9️⃣ 📱 Профиль — аватар, имя, достижения\n🔟 ❓ Помощь — FAQ, руководство, видеоуроки\n\nНапишите номер или тему — отвечу! 😊`;
    }

    let chatHistory = [];
    try { chatHistory = JSON.parse(safeGet(CHAT_KEY) || '[]'); } catch { chatHistory = []; }
    if (!Array.isArray(chatHistory) || chatHistory.length === 0) {
        chatHistory = [{ from: 'bot', text: getWelcomeMessage(), time: Date.now() }];
    }

    function saveChatHistory() { safeSet(CHAT_KEY, JSON.stringify(chatHistory.slice(-100))); }

    function timeString(ts) {
        const d = new Date(ts);
        return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    }

    function renderChatMessage(msg, index) {
        const div = document.createElement('div');
        div.className = `chat-msg ${msg.from}`;
        const icon = msg.from === 'bot' ? 'fa-headset' : 'fa-user';

        let ratingHtml = '';
        if (msg.from === 'bot') {
            const likeActive = msg.rating === 'like' ? 'active' : '';
            const dislikeActive = msg.rating === 'dislike' ? 'active' : '';
            ratingHtml = `
                <div class="chat-rating">
                    <button class="chat-rating-btn ${likeActive}" data-rate="like" data-index="${index}">👍</button>
                    <button class="chat-rating-btn ${dislikeActive}" data-rate="dislike" data-index="${index}">👎</button>
                </div>
            `;
        }

        div.innerHTML = `
            <div class="chat-avatar"><i class="fas ${icon}"></i></div>
            <div>
                <div class="chat-bubble">${msg.text}<span class="chat-time">${timeString(msg.time)}</span></div>
                ${ratingHtml}
            </div>
        `;
        chatMessages.appendChild(div);
    }

    function renderChat() {
        if (!chatMessages) return;
        chatMessages.innerHTML = '';
        chatHistory.forEach((msg, i) => renderChatMessage(msg, i));
        chatMessages.scrollTop = chatMessages.scrollHeight;

        document.querySelectorAll('.chat-rating-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-index'));
                const rate = btn.getAttribute('data-rate');
                chatHistory[idx].rating = chatHistory[idx].rating === rate ? null : rate;
                saveChatHistory();
                renderChat();
            });
        });
    }

    function addChatMessage(text, from) {
        chatHistory.push({ from, text, time: Date.now() });
        saveChatHistory();
        renderChat();
    }

    function showTyping() {
        if (!chatMessages) return;
        const typing = document.createElement('div');
        typing.className = 'chat-msg bot';
        typing.id = 'chatTyping';
        typing.innerHTML = `
            <div class="chat-avatar"><i class="fas fa-headset"></i></div>
            <div class="chat-typing"><span></span><span></span><span></span></div>
        `;
        chatMessages.appendChild(typing);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function hideTyping() { document.getElementById('chatTyping')?.remove(); }

    function getMenuList() {
        return `Вот что я умею:\n\n` +
            `1️1 Транзакции — как добавить расход или доход\n` +
            `2 Цели — как создать и отслеживать\n` +
            `3 Пароль — как сменить пароль\n` +
            `4 Тема — светлая / тёмная / системная\n` +
            `5 Язык — русский / English / беларуская\n` +
            `6 Данные — где хранится информация\n` +
            `7 Статистика — неделя / месяц / год\n` +
            `8 Безопасность — 2FA, отпечаток, устройства\n` +
            `9 Профиль — аватар, имя, достижения\n` +
            `10 Помощь — FAQ, руководство, видеоуроки\n\n` +
            `Напишите номер или тему — отвечу! 😊`;
    }

    function getBotReply(text) {
        const t = text.toLowerCase().trim();

        const amountMatch = t.match(/(\d+[\.,]?\d*)\s*(byn|руб|бел|бр)?/i);
        if (/(добав|запиши|внеси|внести|создай.*транзакц)/.test(t) && amountMatch) {
            const amount = parseFloat(amountMatch[1].replace(',', '.'));
            return `Отлично! Чтобы добавить транзакцию на ${amount} BYN — нажмите жёлтую кнопку «+» на главном экране. Укажите категорию, введите ${amount} в поле суммы и нажмите «Сохранить». 💸`;
        }

        if (/(что.*умеешь|твои.*функц|меню|help me|список.*вопрос|что.*можешь|чем.*помочь|возможност)/.test(t)) return getMenuList();
        if (/(привет|здравств|хай|hello|hi|добрый|доброе)/.test(t)) return `Здравствуйте! 👋 Рад помочь!\n\n` + getMenuList();

        if (t === '1' || /^1️⃣/.test(t) || /транзак/.test(t)) return '💸 Добавить транзакцию: нажмите жёлтую кнопку «+» внизу экрана → выберите «Расход» или «Доход» → укажите категорию, сумму, дату и заметку → «Сохранить».';
        if (t === '2' || /^2️⃣/.test(t) || /^цел|копить|накопл/.test(t)) return '🎯 Создать цель: раздел «Цели» в нижнем меню → «+ Новая цель» → введите название, сумму, дату, иконку и описание.';
        if (t === '3' || /^3️⃣/.test(t) || /парол/.test(t)) return '🔐 Смена пароля: Настройки → Безопасность → Сменить пароль.';
        if (t === '4' || /^4️⃣/.test(t) || /тем[ауы]|тёмн|светл/.test(t)) return '🎨 Смена темы: Настройки → Тема. Доступны: 🌞 Светлая, 🌙 Тёмная, 💻 Системная.';
        if (t === '5' || /^5️⃣/.test(t) || /язык|english/.test(t)) return '🌐 Смена языка: Настройки → Язык. Доступны: 🇷🇺 Русский, 🇬🇧 English, 🇧🇾 Беларуская.';
        if (t === '6' || /^6️⃣/.test(t) || /данн|сохран|где хранятся/.test(t)) return '💾 Данные хранятся локально в браузере (localStorage). Сброс — F12 → Console → localStorage.clear().';
        if (t === '7' || /^7️⃣/.test(t) || /статист|график|динамик/.test(t)) return '📊 Статистика: Профиль → переключатель Неделя / Месяц / Год.';
        if (t === '8' || /^8️⃣/.test(t) || /безопасн|2fa|двухфакт|отпечат/.test(t)) return '🛡️ Безопасность: Настройки → Безопасность.';
        if (t === '9' || /^9️⃣/.test(t) || /профил|аватар/.test(t)) return '📱 Профиль: нижнее меню → «Профиль».';
        if (t === '10' || /🔟/.test(t) || /помощ|support/.test(t)) return '❓ Помощь: Настройки → Помощь.';

        if (/(как дела|как ты)/.test(t)) return 'У меня всё отлично 😄 Чем помочь?\n\n' + getMenuList();
        if (/(кто ты|что ты|ты кто)/.test(t)) return 'Я виртуальный помощник BudgetBee 🤖 Напишите «что ты умеешь».';
        if (/(регистрац|создать.*акк)/.test(t)) return 'Для регистрации: «Начать» → имя, email, пароль (6+ символов) → галочка → «Создать аккаунт».';
        if (/(вход|войти|логин|login)/.test(t)) return 'Для входа: «У меня уже есть аккаунт» → email и пароль → «Войти».';
        if (/(выход|выйти|logout)/.test(t)) return 'Выход: Настройки → красный пункт «Выйти» внизу.';
        if (/(сброс|очист|удал.*всё|reset|clear)/.test(t)) return 'Сброс данных: F12 → Console → localStorage.clear() → Enter.';
        if (/(баланс|сколько.*денег|остаток)/.test(t)) return `💼 Ваш баланс: ${currentUser ? formatNumber(currentUser.balance) + ' BYN' : 'войдите в аккаунт'}.`;
        if (/(категор|тип.*расход)/.test(t)) return '📂 9 категорий: 🍴 Еда, 🚌 Транспорт, 🎮 Развлечения, 🏠 Жильё, ❤️ Здоровье, 👕 Одежда, 🎓 Образование, 🛍️ Покупки, ⋯ Другое.';
        if (/(уведомл|колокольчик)/.test(t)) return '🔔 Уведомления — колокольчик в правом верхнем углу.';
        if (/(истори.*вход|когда.*вход)/.test(t)) return '📜 История входов: Настройки → Безопасность.';
        if (/(устройств|сеанс|device)/.test(t)) return '📱 Доверенные устройства: Настройки → Безопасность.';
        if (/(faq|частые вопрос)/.test(t)) return '❓ FAQ: Настройки → Помощь → Частые вопросы.';
        if (/(обратн.*связ|написать|feedback)/.test(t)) return '💛 Напишите на support@budgetbee.by.';
        if (/(баг|ошибк|не работа|bug|error)/.test(t)) return '🔧 Попробуйте: 1) Ctrl+F5, 2) localStorage.clear(), 3) зарегистрируйтесь заново.';
        if (/(спасиб|благодар|thanks)/.test(t)) return 'Пожалуйста! 💛';
        if (/(пока|до свидан|bye)/.test(t)) return 'До связи! 👋';
        if (/(о прилож|about|версия)/.test(t)) return '📱 BudgetBee v1.0.0 — приложение для контроля личных финансов.';
        if (/(совет|эконом|сбереч|копить)/.test(t)) return '💡 3 совета: 1) Записывайте траты. 2) Ставьте цели на 3-6 мес. 3) Откладывайте 10-20% дохода.';
        if (/(мотивац|вдохновл)/.test(t)) return '🌟 «Деньги любят счёт» — каждая запись приближает к свободе.';
        if (/(время|который.*час)/.test(t)) { const n = new Date(); return `🕒 Сейчас ${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}.`; }
        if (/(дата|какое.*число|сегодня)/.test(t)) { const n = new Date(); const m = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря']; return `📅 Сегодня ${n.getDate()} ${m[n.getMonth()]} ${n.getFullYear()} года.`; }
        if (/(шутк|анекдот|joke)/.test(t)) return '😂 Почему программист держит деньги в биткоинах? Боится, что банк обнулит депозит.';
        if (/(устал|спать|сон|отдых)/.test(t)) return '😴 Отдохните! Пока спите — расходов меньше.';

        return `🤔 Я не совсем понял ваш вопрос.\n\n` + getMenuList();
    }

    function sendChat(text) {
        const msg = (text || chatInput?.value || '').trim();
        if (!msg) return;
        addChatMessage(msg, 'user');
        if (chatInput) chatInput.value = '';
        showTyping();
        setTimeout(() => {
            hideTyping();
            addChatMessage(getBotReply(msg), 'bot');
        }, 600);
    }

    chatSendBtn?.addEventListener('click', () => sendChat());
    chatInput?.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChat(); });

    document.querySelectorAll('.quick-btn').forEach(btn => {
        btn.addEventListener('click', () => sendChat(btn.getAttribute('data-quick')));
    });

    chatExportBtn?.addEventListener('click', () => {
        if (chatHistory.length === 0) return;
        let text = 'Переписка с поддержкой BudgetBee\n' + '='.repeat(40) + '\n\n';
        chatHistory.forEach(msg => {
            const who = msg.from === 'bot' ? '🤖 Поддержка' : '👤 Вы';
            const t = timeString(msg.time);
            text += `[${t}] ${who}:\n${msg.text}\n\n`;
        });
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat_budgetbee_${new Date().toISOString().slice(0,10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    });

    chatClearBtn?.addEventListener('click', () => {
        if (!confirm('Очистить всю переписку с поддержкой?\n\nЭто действие нельзя отменить.')) return;
        chatHistory = [{ from: 'bot', text: getWelcomeMessage(), time: Date.now() }];
        saveChatHistory();
        renderChat();
    });

   
    const savedTheme = safeGet('theme');
    if (savedTheme) applyTheme(savedTheme);

    const savedLang = safeGet('lang');
    if (savedLang) {
        applyLanguage(savedLang);
        document.querySelectorAll('#screen-language .theme-option').forEach(o => {
            o.classList.remove('active');
            const ic = o.querySelector('i:last-child');
            if (ic) ic.style.visibility = 'hidden';
            if (o.getAttribute('data-lang') === savedLang) {
                o.classList.add('active');
                const ic2 = o.querySelector('i:last-child');
                if (ic2) ic2.style.visibility = 'visible';
            }
        });
    }

    
    renderChat();
    renderChart('week');
});