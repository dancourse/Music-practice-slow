// ==================== //
// YouTube Player App   //
// ==================== //

// Account Manager Class
class AccountManager {
    constructor() {
        this.accountType = this.getAccountType();
        this.licenseKey = this.getLicenseKey();
        this.welcomeShown = this.getWelcomeShown();
        this.userId = this.getUserId();

        // Check and update referral status on load
        this.checkReferralExpiry();
    }

    getAccountType() {
        return localStorage.getItem('musicPracticeAccountType') || 'free';
    }

    setAccountType(type) {
        localStorage.setItem('musicPracticeAccountType', type);
        this.accountType = type;
    }

    getLicenseKey() {
        return localStorage.getItem('musicPracticeLicenseKey') || null;
    }

    setLicenseKey(key) {
        localStorage.setItem('musicPracticeLicenseKey', key);
        this.licenseKey = key;
    }

    getWelcomeShown() {
        return localStorage.getItem('musicPracticeWelcomeShown') === 'true';
    }

    setWelcomeShown() {
        localStorage.setItem('musicPracticeWelcomeShown', 'true');
        this.welcomeShown = true;
    }

    isPaid() {
        return this.accountType === 'paid';
    }

    validateLicenseKey(key) {
        // Format: MUSIC-PRACTICE-XXXX-XXXX-XXXX
        const pattern = /^MUSIC-PRACTICE-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
        return pattern.test(key.toUpperCase());
    }

    upgrade(licenseKey) {
        if (this.validateLicenseKey(licenseKey)) {
            this.setAccountType('paid');
            this.setLicenseKey(licenseKey);
            return true;
        }
        return false;
    }

    // ==================== //
    // Referral System      //
    // ==================== //

    getUserId() {
        let userId = localStorage.getItem('musicPracticeUserId');
        if (!userId) {
            userId = 'user-' + this.generateRandomCode(12);
            localStorage.setItem('musicPracticeUserId', userId);
        }
        return userId;
    }

    getReferralCode() {
        return localStorage.getItem('musicPracticeReferralCode') || null;
    }

    setReferralCode(code) {
        localStorage.setItem('musicPracticeReferralCode', code);
    }

    getReferredBy() {
        return localStorage.getItem('musicPracticeReferredBy') || null;
    }

    setReferredBy(code) {
        localStorage.setItem('musicPracticeReferredBy', code);
    }

    getReferralExpiry() {
        return localStorage.getItem('musicPracticeReferralExpiry') || null;
    }

    setReferralExpiry(date) {
        localStorage.setItem('musicPracticeReferralExpiry', date);
    }

    generateRandomCode(length) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    async generateReferralCode() {
        // Check if we already have a code
        let code = this.getReferralCode();
        if (code) return code;

        // Generate a new code
        code = 'REF-' + this.generateRandomCode(8);

        // Try to register it with the backend
        try {
            const response = await fetch('/.netlify/functions/generate-referral-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.userId,
                    code: code
                })
            });

            if (response.ok) {
                const data = await response.json();
                code = data.code || code;
            }
        } catch (e) {

        }

        this.setReferralCode(code);
        return code;
    }

    isReferralActive() {
        if (this.accountType !== 'referral') return false;

        const expiry = this.getReferralExpiry();
        if (!expiry) return false;

        return new Date(expiry) > new Date();
    }

    checkReferralExpiry() {
        if (this.accountType === 'referral' && !this.isReferralActive()) {
            // Referral has expired, revert to free
            this.setAccountType('free');
            this.accountType = 'free';
        }
    }

    upgradeToReferral() {
        const expiry = new Date();
        expiry.setMonth(expiry.getMonth() + 3); // 3 months from now

        this.setAccountType('referral');
        this.setReferralExpiry(expiry.toISOString());
        this.accountType = 'referral';
    }

    getVideoLimit() {
        if (this.accountType === 'paid') return Infinity;
        if (this.accountType === 'referral' && this.isReferralActive()) return 5;
        return 3;
    }

    getRemainingReferralDays() {
        if (!this.isReferralActive()) return 0;

        const expiry = new Date(this.getReferralExpiry());
        const now = new Date();
        const diffTime = expiry - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(0, diffDays);
    }
}

class MusicPracticeApp {
    constructor() {
        // State
        this.videos = [];
        this.currentVideoId = null;
        this.player = null;
        this.playerReady = false;
        this.loopStart = null;
        this.loopEnd = null;
        this.loopEnabled = false;
        this.loopCheckInterval = null;
        this.timeUpdateInterval = null;

        // Practice Timer State
        this._practiceTimerSeconds = 0;
        this._practiceTimerInterval = null;
        this._practiceTimerRunning = false;
        this._loopRepCount = 0;
        this._lastLoopSeekTime = 0;
        this._practiceStatsInterval = null;

        // Pending shareable URL settings (applied after player is ready)
        this._pendingShareParams = null;

        // Progressive Speed Training State
        this._progressiveEnabled = false;
        this._progressiveRepsPerStep = 3;      // loops before speed increase
        this._progressiveSpeedStep = 0.05;     // speed increment per step
        this._progressiveTargetSpeed = 1.0;    // goal speed
        this._progressiveRepsAtCurrentSpeed = 0; // reps counted at current speed

        // Metronome State
        this._metronomeAudioCtx = null;
        this._metronomeRunning = false;
        this._metronomeBpm = 120;
        this._metronomeTimeSig = [4, 4]; // [beats, noteValue]
        this._metronomeVolume = 0.5;
        this._metronomeBeatCount = 0;
        this._metronomeNextNoteTime = 0;
        this._metronomeSchedulerTimer = null;
        this._metronomeLookahead = 25.0; // ms
        this._metronomeScheduleAheadTime = 0.1; // seconds
        this._metronomeTapTimes = [];

        // YouTube API lazy-loading state
        this._ytApiLoaded = false;
        this._ytApiLoading = false;
        this._ytApiReadyResolve = null;
        this._ytApiReadyPromise = new Promise((resolve) => {
            this._ytApiReadyResolve = resolve;
        });

        // Account Manager
        this.accountManager = new AccountManager();

        // YouTube API key (from environment variable via Netlify)
        this.youtubeApiKey = window.YOUTUBE_API_KEY || '';

        // DOM Elements
        this.elements = {
            videoUrlInput: document.getElementById('videoUrlInput'),
            addVideoBtn: document.getElementById('addVideoBtn'),
            videoList: document.getElementById('videoList'),
            playerSection: document.getElementById('playerSection'),
            currentVideoTitle: document.getElementById('currentVideoTitle'),
            playPauseBtn: document.getElementById('playPauseBtn'),
            skipToStartBtn: document.getElementById('skipToStartBtn'),
            speedSlider: document.getElementById('speedSlider'),
            speedDisplay: document.getElementById('speedDisplay'),
            speedPresets: document.querySelectorAll('.btn-preset'),
            seekBackBtn: document.getElementById('seekBackBtn'),
            seekForwardBtn: document.getElementById('seekForwardBtn'),
            timelineSlider: document.getElementById('timelineSlider'),
            currentTime: document.getElementById('currentTime'),
            duration: document.getElementById('duration'),
            progressBar: document.getElementById('progressBar'),
            loopOverlay: document.getElementById('loopOverlay'),
            setLoopStartBtn: document.getElementById('setLoopStartBtn'),
            setLoopEndBtn: document.getElementById('setLoopEndBtn'),
            toggleLoopBtn: document.getElementById('toggleLoopBtn'),
            clearLoopBtn: document.getElementById('clearLoopBtn'),
            loopStartDisplay: document.getElementById('loopStartDisplay'),
            loopEndDisplay: document.getElementById('loopEndDisplay'),
            searchSection: document.getElementById('searchSection'),
            searchInput: document.getElementById('searchInput'),
            searchBtn: document.getElementById('searchBtn'),
            searchResults: document.getElementById('searchResults')
        };

        this.init();
    }

    init() {
        // Wake Lock state
        this._wakeLock = null;

        // Handle referral URL parameter
        this.handleReferralFromUrl();

        // Load videos from localStorage
        this.loadVideos();
        this.renderVideoList();

        // Bind event listeners
        this.bindEvents();

        // Show search if API key available
        if (this.youtubeApiKey) {
            this.elements.searchSection.style.display = 'block';
        }

        // Check for shareable URL params
        const hasShareParams = this.handleShareableUrl();

        // Hide welcome banner for returning users; show for first-time (banner starts visible in HTML to avoid CLS)
        if (hasShareParams) {
            const banner = document.getElementById('welcomeBanner');
            if (banner) banner.style.display = 'none';
        } else {
            this.showWelcomeBannerIfNeeded();
        }

        // Mark old welcome modal as shown so it never appears
        if (!this.accountManager.welcomeShown) {
            this.accountManager.setWelcomeShown();
        }

        // Initialize analytics
        this.identifyUser();
        this.trackEvent('page_loaded', {
            hasApiKey: !!this.youtubeApiKey,
            referredBy: this.accountManager.getReferredBy() || null,
            sharedLink: hasShareParams
        });

        // Set account created date if not set
        if (!localStorage.getItem('musicPracticeAccountCreated')) {
            localStorage.setItem('musicPracticeAccountCreated', new Date().toISOString());
        }

        // Update account UI
        this.updateAccountUI();

        // Inject mobile speed presets (large tap targets near player)
        this.injectMobileSpeedPresets();

        // Request Wake Lock to keep screen on during practice
        this.requestWakeLock();

        // Re-acquire Wake Lock when page becomes visible again
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.requestWakeLock();
            }
        });

        // Initialize practice timer & stats
        this.initPracticeTimer();

        // Initialize metronome
        this.initMetronome();

        // Initialize progressive speed training
        this.initProgressiveTraining();

        // YouTube API is lazy-loaded when a video is first needed (createPlayer)
    }

    handleReferralFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const refCode = urlParams.get('ref');

        if (refCode && !this.accountManager.getReferredBy()) {
            // Store the referral code
            this.accountManager.setReferredBy(refCode);
            this.trackEvent('referral_link_visited', { referralCode: refCode });

            // Clean the URL
            const url = new URL(window.location);
            url.searchParams.delete('ref');
            window.history.replaceState({}, '', url);
        }
    }

    // ==================== //
    // Shareable URLs       //
    // ==================== //

    handleShareableUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const videoId = urlParams.get('v');

        if (!videoId) return false;

        // Parse optional params
        const start = parseFloat(urlParams.get('start'));
        const end = parseFloat(urlParams.get('end'));
        const speed = parseFloat(urlParams.get('speed'));

        // Store pending settings to apply once player is ready
        this._pendingShareParams = {
            videoId: videoId,
            start: isNaN(start) ? null : start,
            end: isNaN(end) ? null : end,
            speed: isNaN(speed) ? null : Math.max(0.25, Math.min(2, speed))
        };

        // Track the shared link visit
        this.trackEvent('shared_link_visited', {
            videoId: videoId,
            hasLoop: !isNaN(start) && !isNaN(end),
            speed: isNaN(speed) ? null : speed
        });

        // Clean the share params from URL (keep ref if present)
        const url = new URL(window.location);
        url.searchParams.delete('v');
        url.searchParams.delete('start');
        url.searchParams.delete('end');
        url.searchParams.delete('speed');
        window.history.replaceState({}, '', url.toString());

        // Add video to library if not already there (don't count against limit for shared links)
        if (!this.videos.find(v => v.id === videoId)) {
            const video = {
                id: videoId,
                title: null, // Will be fetched
                addedAt: Date.now()
            };
            this.videos.push(video);
            this.saveVideos();
            this.renderVideoList();

            // Fetch title in background
            this.fetchVideoTitle(videoId).then(title => {
                if (title) {
                    const v = this.videos.find(v => v.id === videoId);
                    if (v) {
                        v.title = title;
                        this.saveVideos();
                        this.renderVideoList();
                    }
                }
            });
        }

        // Show player section and load the video
        this.currentVideoId = videoId;
        this.elements.playerSection.style.display = 'block';
        this.renderVideoList();

        // Show share section
        const shareSection = document.getElementById('shareSection');
        if (shareSection) shareSection.style.display = 'block';

        // Show saved loops section
        const saveSection = document.getElementById('saveLoopSection');
        if (saveSection) saveSection.style.display = 'block';
        this.renderSavedLoops(videoId);

        // Show metronome section
        const metronomeSection = document.getElementById('metronomeSection');
        if (metronomeSection) metronomeSection.style.display = 'block';

        // Create the player (settings applied in onPlayerReady)
        this.createPlayer(videoId);

        return true;
    }

    applyPendingShareParams() {
        if (!this._pendingShareParams || !this.player || !this.playerReady) return;

        const params = this._pendingShareParams;
        this._pendingShareParams = null;

        // Set speed
        if (params.speed !== null) {
            this.setSpeed(params.speed);
            this.elements.speedSlider.value = params.speed;
        }

        // Set loop points
        if (params.start !== null && params.end !== null && params.start < params.end) {
            this.loopStart = params.start;
            this.loopEnd = params.end;
            this.elements.loopStartDisplay.textContent = this.formatTime(params.start);
            this.elements.loopEndDisplay.textContent = this.formatTime(params.end);
            this.updateLoopUI();
            this.checkLoopButtonState();

            // Enable the loop
            this.loopEnabled = true;
            this.elements.toggleLoopBtn.textContent = 'Disable Loop';
            this.elements.toggleLoopBtn.classList.add('active');
            this.startLoopCheck();

            // Seek to loop start
            this.player.seekTo(params.start, true);
        } else if (params.start !== null) {
            // Just start point, no loop - seek there
            this.player.seekTo(params.start, true);
        }

        // Update the share URL display
        this.updateShareUrl();

        // Auto-play
        this.player.playVideo();
    }

    generateShareUrl() {
        if (!this.currentVideoId || !this.player || !this.playerReady) return null;

        const url = new URL(window.location.origin + window.location.pathname);
        url.searchParams.set('v', this.currentVideoId);

        if (this.loopStart !== null) {
            url.searchParams.set('start', Math.round(this.loopStart * 10) / 10);
        }
        if (this.loopEnd !== null) {
            url.searchParams.set('end', Math.round(this.loopEnd * 10) / 10);
        }

        const currentSpeed = this.player.getPlaybackRate();
        if (currentSpeed !== 1) {
            url.searchParams.set('speed', currentSpeed);
        }

        return url.toString();
    }

    copyShareUrl() {
        const url = this.generateShareUrl();
        if (!url) {
            alert('Load a video first to generate a share link.');
            return;
        }

        try {
            navigator.clipboard.writeText(url);
            this.trackEvent('share_url_copied', { videoId: this.currentVideoId });

            // Visual feedback
            const btn = document.getElementById('copyShareUrlBtn');
            if (btn) {
                const originalText = btn.textContent;
                btn.textContent = 'Copied!';
                btn.classList.add('copied');
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.classList.remove('copied');
                }, 2000);
            }
        } catch (e) {
            // Fallback for older browsers
            const input = document.createElement('input');
            input.value = url;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
        }
    }

    updateShareUrl() {
        const display = document.getElementById('shareUrlDisplay');
        if (!display) return;

        if (!this.currentVideoId) {
            display.value = '';
            display.placeholder = 'Load a video first';
            return;
        }

        // Build a basic share URL even if player isn't ready yet
        const url = new URL(window.location.origin + window.location.pathname);
        url.searchParams.set('v', this.currentVideoId);

        if (this.loopStart !== null) {
            url.searchParams.set('start', Math.round(this.loopStart * 10) / 10);
        }
        if (this.loopEnd !== null) {
            url.searchParams.set('end', Math.round(this.loopEnd * 10) / 10);
        }

        // Get speed from player if available, otherwise from slider
        if (this.player && this.playerReady) {
            const currentSpeed = this.player.getPlaybackRate();
            if (currentSpeed !== 1) {
                url.searchParams.set('speed', currentSpeed);
            }
        } else {
            const sliderSpeed = parseFloat(this.elements.speedSlider.value);
            if (sliderSpeed !== 1) {
                url.searchParams.set('speed', sliderSpeed);
            }
        }

        display.value = url.toString();
    }

    // ==================== //
    // Analytics Tracking   //
    // ==================== //

    trackEvent(eventName, properties = {}) {
        if (window.heap && typeof window.heap.track === 'function') {
            const eventData = {
                ...properties,
                accountType: this.accountManager.accountType,
                videoCount: this.videos.length
            };

            window.heap.track(eventName, eventData);
        } else {

        }
    }

    identifyUser() {
        if (window.heap && typeof window.heap.addUserProperties === 'function') {
            const userData = {
                accountType: this.accountManager.accountType,
                videoCount: this.videos.length,
                hasYouTubeApiKey: !!this.youtubeApiKey
            };

            window.heap.addUserProperties(userData);
        } else {

        }
    }

    // ==================== //
    // Mobile Speed Presets //
    // ==================== //

    injectMobileSpeedPresets() {
        const speedControl = document.querySelector('.speed-control');
        if (!speedControl) return;

        const presets = [
            { label: '50%', speed: 0.5 },
            { label: '65%', speed: 0.65 },
            { label: '75%', speed: 0.75 },
            { label: '100%', speed: 1.0 }
        ];

        const container = document.createElement('div');
        container.className = 'speed-presets-mobile';

        presets.forEach(p => {
            const btn = document.createElement('button');
            btn.className = 'btn-preset-mobile' + (p.speed === 1.0 ? ' active' : '');
            btn.textContent = p.label;
            btn.dataset.speed = p.speed;
            btn.addEventListener('click', () => {
                this.setSpeed(p.speed);
                this.elements.speedSlider.value = p.speed;
                // Update active state on mobile presets
                container.querySelectorAll('.btn-preset-mobile').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
            container.appendChild(btn);
        });

        // Insert before the slider label
        speedControl.insertBefore(container, speedControl.firstChild);

        // Add wake lock indicator below controls
        const controls = document.querySelector('.controls');
        if (controls) {
            const indicator = document.createElement('div');
            indicator.className = 'wake-lock-indicator';
            indicator.id = 'wakeLockIndicator';
            indicator.textContent = 'Screen will stay on while practicing';
            controls.appendChild(indicator);
        }
    }

    // ==================== //
    // Wake Lock API        //
    // ==================== //

    async requestWakeLock() {
        if (!('wakeLock' in navigator)) {

            return;
        }

        try {
            this._wakeLock = await navigator.wakeLock.request('screen');


            const indicator = document.getElementById('wakeLockIndicator');
            if (indicator) indicator.classList.add('active');

            this._wakeLock.addEventListener('release', () => {

                const ind = document.getElementById('wakeLockIndicator');
                if (ind) ind.classList.remove('active');
            });
        } catch (err) {
            // Wake Lock request failed (e.g., low battery, not supported)

        }
    }

    async releaseWakeLock() {
        if (this._wakeLock) {
            try {
                await this._wakeLock.release();
                this._wakeLock = null;
            } catch (err) {

            }
        }
    }

    // ==================== //
    // YouTube API Lazy Load //
    // ==================== //

    loadYouTubeAPI() {
        // Already loaded
        if (this._ytApiLoaded) {
            return this._ytApiReadyPromise;
        }

        // Already loading, just return the promise
        if (this._ytApiLoading) {
            return this._ytApiReadyPromise;
        }

        this._ytApiLoading = true;


        // Dynamically inject the script tag
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.onerror = () => {

            this._ytApiLoading = false;
            this.hidePlayerLoading();
        };
        document.head.appendChild(script);

        return this._ytApiReadyPromise;
    }

    onYouTubeAPIReady() {
        this._ytApiLoaded = true;
        this._ytApiLoading = false;


        if (this._ytApiReadyResolve) {
            this._ytApiReadyResolve();
        }
    }

    showPlayerLoading() {
        const playerDiv = document.getElementById('player');
        if (playerDiv && !playerDiv.querySelector('.yt-loading-placeholder')) {
            const placeholder = document.createElement('div');
            placeholder.className = 'yt-loading-placeholder';
            placeholder.innerHTML = '<div class="yt-loading-spinner"></div><p>Loading player...</p>';
            playerDiv.appendChild(placeholder);
        }
    }

    hidePlayerLoading() {
        const placeholder = document.querySelector('.yt-loading-placeholder');
        if (placeholder) {
            placeholder.remove();
        }
    }

    bindEvents() {
        // Add video
        this.elements.addVideoBtn.addEventListener('click', () => this.addVideo());
        this.elements.videoUrlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addVideo();
        });

        // Search
        if (this.youtubeApiKey) {
            this.elements.searchBtn.addEventListener('click', () => this.searchVideos());
            this.elements.searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.searchVideos();
            });
        }

        // Playback controls
        this.elements.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        this.elements.skipToStartBtn.addEventListener('click', () => this.skipToStart());
        this.elements.speedSlider.addEventListener('input', (e) => this.setSpeed(parseFloat(e.target.value)));
        this.elements.speedPresets.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const speed = parseFloat(e.target.dataset.speed);
                this.setSpeed(speed);
                this.elements.speedSlider.value = speed;
            });
        });

        // Seek controls
        this.elements.seekBackBtn.addEventListener('click', () => this.seek(-5));
        this.elements.seekForwardBtn.addEventListener('click', () => this.seek(5));

        // Timeline
        this.elements.timelineSlider.addEventListener('input', (e) => this.seekToPercent(e.target.value));

        // Loop controls
        this.elements.setLoopStartBtn.addEventListener('click', () => this.setLoopStart());
        this.elements.setLoopEndBtn.addEventListener('click', () => this.setLoopEnd());
        this.elements.toggleLoopBtn.addEventListener('click', () => this.toggleLoop());
        this.elements.clearLoopBtn.addEventListener('click', () => this.clearLoop());

        // Welcome banner dismiss
        const welcomeDismissBtn = document.getElementById('welcomeDismissBtn');
        if (welcomeDismissBtn) {
            welcomeDismissBtn.addEventListener('click', () => this.dismissWelcomeBanner());
        }

        // Shortcuts help toggle
        const shortcutsHelpBtn = document.getElementById('shortcutsHelpBtn');
        if (shortcutsHelpBtn) {
            shortcutsHelpBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tooltip = document.getElementById('shortcutsTooltip');
                if (tooltip) {
                    tooltip.classList.toggle('visible');
                }
            });

            // Close tooltip when clicking elsewhere
            document.addEventListener('click', (e) => {
                const tooltip = document.getElementById('shortcutsTooltip');
                const helpContainer = document.getElementById('shortcutsHelp');
                if (tooltip && helpContainer && !helpContainer.contains(e.target)) {
                    tooltip.classList.remove('visible');
                }
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Don't fire if typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.code === 'Space') { e.preventDefault(); this.togglePlayPause(); }
            if (e.key === '[') this.setLoopStart();
            if (e.key === ']') this.setLoopEnd();
            if (e.key === 'l' || e.key === 'L') { if (this.loopStart !== null && this.loopEnd !== null) this.toggleLoop(); }
            if (e.key === 'ArrowLeft') { e.preventDefault(); this.seek(-5); }
            if (e.key === 'ArrowRight') { e.preventDefault(); this.seek(5); }
        });
    }

    // ==================== //
    // Video Management     //
    // ==================== //

    extractVideoId(url) {
        // Support various YouTube URL formats
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
            /^([a-zA-Z0-9_-]{11})$/ // Direct video ID
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        return null;
    }

    async addVideo(videoId = null, videoTitle = null) {
        // If no videoId provided, extract from URL input
        if (!videoId) {
            const url = this.elements.videoUrlInput.value.trim();
            if (!url) {
                alert('Please enter a YouTube URL');
                return;
            }

            videoId = this.extractVideoId(url);
            if (!videoId) {
                alert('Invalid YouTube URL. Please check and try again.');
                return;
            }
        }

        // Check video limit based on account type
        const videoLimit = this.accountManager.getVideoLimit();







        if (this.videos.length >= videoLimit) {

            this.showUpgradeModal();
            return;
        }

        // Check if video already exists
        if (this.videos.find(v => v.id === videoId)) {
            alert('This video is already in your library');
            return;
        }

        // Try to fetch video title if not provided
        if (!videoTitle) {
            videoTitle = await this.fetchVideoTitle(videoId);
        }

        // Add video
        const video = {
            id: videoId,
            title: videoTitle || null,
            addedAt: Date.now()
        };

        this.videos.push(video);
        this.saveVideos();
        this.renderVideoList();

        // Hide welcome banner if visible
        this.dismissWelcomeBanner();

        // Clear input
        this.elements.videoUrlInput.value = '';

        // Confetti! (lazy-loaded)
        if (window.confetti) {
            confetti.burst();
        } else if (!this._confettiLoading) {
            this._confettiLoading = true;
            const s = document.createElement('script');
            s.src = 'confetti.js';
            s.onload = () => { if (window.confetti) confetti.burst(); };
            document.head.appendChild(s);
        }

        // Track event
        this.trackEvent('video_added', {
            method: videoId && videoTitle ? 'search' : 'url',
            videoId: videoId
        });

        // Check if this is a referred user's first video - trigger referral reward
        if (this.videos.length === 1 && this.accountManager.getReferredBy()) {
            this.recordReferralSignup();
        }

        // Auto-select if first video
        if (this.videos.length === 1) {
            this.selectVideo(videoId);
        }
    }

    async fetchVideoTitle(videoId) {
        try {
            // Try YouTube oEmbed API (no auth required)
            const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
            if (response.ok) {
                const data = await response.json();
                return data.title;
            }
        } catch (e) {

        }
        return null;
    }

    async searchVideos() {
        if (!this.youtubeApiKey) return;

        const query = this.elements.searchInput.value.trim();
        if (!query) {
            alert('Please enter a search term');
            return;
        }

        try {
            const response = await fetch(
                `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=5&key=${this.youtubeApiKey}`
            );

            if (!response.ok) {
                throw new Error('Search failed');
            }

            const data = await response.json();
            // Track event
            this.trackEvent('search_performed', {query: query, resultCount: data.items.length});
            this.renderSearchResults(data.items);
        } catch (e) {

            alert('Search failed. Please check your API key.');
        }
    }

    renderSearchResults(items) {
        if (!items || items.length === 0) {
            this.elements.searchResults.innerHTML = '<p style="color: #6b7280; padding: 1rem; text-align: center;">No results found</p>';
            return;
        }

        this.elements.searchResults.innerHTML = items.map(item => `
            <div class="search-result-item" data-video-id="${item.id.videoId}" data-video-title="${this.escapeHtml(item.snippet.title)}">
                <img src="${item.snippet.thumbnails.default.url}" alt="${this.escapeHtml(item.snippet.title)}">
                <div class="search-result-info">
                    <h4>${this.escapeHtml(item.snippet.title)}</h4>
                    <p>${this.escapeHtml(item.snippet.channelTitle)}</p>
                </div>
            </div>
        `).join('');

        // Add click listeners
        document.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const videoId = item.dataset.videoId;
                const videoTitle = item.dataset.videoTitle;
                this.addVideo(videoId, videoTitle);
                this.elements.searchResults.innerHTML = '';
                this.elements.searchInput.value = '';
            });
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    removeVideo(videoId) {
        if (confirm('Remove this video from your library?')) {
            this.videos = this.videos.filter(v => v.id !== videoId);
            this.saveVideos();
            this.renderVideoList();

            // Track event
            this.trackEvent('video_removed', {videoId: videoId});

            // If current video was removed, clear player
            if (this.currentVideoId === videoId) {
                this.currentVideoId = null;
                this.elements.playerSection.style.display = 'none';
            }
        }
    }

    selectVideo(videoId) {
        this.currentVideoId = videoId;
        this.clearLoop();

        // Track event
        this.trackEvent('video_selected', {videoId: videoId});

        // Show player section
        this.elements.playerSection.style.display = 'block';

        // Show share section and update URL
        const shareSection = document.getElementById('shareSection');
        if (shareSection) shareSection.style.display = 'block';
        this.updateShareUrl();

        // Show saved loops section
        const saveSection = document.getElementById('saveLoopSection');
        if (saveSection) saveSection.style.display = 'block';
        this.renderSavedLoops(videoId);

        // Show session stats section
        if (this._sessionStatsSection) {
            this._sessionStatsSection.style.display = 'block';
        }

        // Show metronome section
        const metronomeSection = document.getElementById('metronomeSection');
        if (metronomeSection) metronomeSection.style.display = 'block';

        // Update active state in list
        this.renderVideoList();

        // Load video in player
        if (this.playerReady && this.player) {
            this.player.loadVideoById(videoId);
            this.elements.currentVideoTitle.textContent = `Video ID: ${videoId}`;
        } else {
            // Player not ready yet, create it
            this.createPlayer(videoId);
        }
    }

    // ==================== //
    // YouTube Player       //
    // ==================== //

    async createPlayer(videoId) {
        // Show loading placeholder while API loads
        this.showPlayerLoading();

        // Ensure YouTube API is loaded
        if (!window.YT || !window.YT.Player) {
            await this.loadYouTubeAPI();
        }

        this.hidePlayerLoading();

        // The YT.Player constructor replaces the target element, so ensure
        // the div exists and is not already a player instance
        const playerDiv = document.getElementById('player');
        if (!playerDiv) {
            console.error('Player div not found');
            return;
        }

        this.player = new YT.Player('player', {
            height: '100%',
            width: '100%',
            videoId: videoId,
            playerVars: {
                controls: 0,
                modestbranding: 1,
                rel: 0
            },
            events: {
                onReady: (event) => this.onPlayerReady(event),
                onStateChange: (event) => this.onPlayerStateChange(event)
            }
        });
    }

    onPlayerReady(event) {
        this.playerReady = true;


        // Start time update interval
        this.startTimeUpdate();

        // Update video title if possible
        if (this.player && this.player.getVideoData) {
            const videoData = this.player.getVideoData();
            if (videoData && videoData.title) {
                this.elements.currentVideoTitle.textContent = videoData.title;
            }
        }

        // Apply any pending shareable URL settings
        if (this._pendingShareParams) {
            // Small delay to ensure player is fully initialized and duration is available
            setTimeout(() => this.applyPendingShareParams(), 500);
        }
    }

    onPlayerStateChange(event) {
        // Update play/pause button
        if (event.data === YT.PlayerState.PLAYING) {
            this.elements.playPauseBtn.classList.add('playing');
            this.startPracticeTimer();
        } else {
            this.elements.playPauseBtn.classList.remove('playing');
            if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
                this.pausePracticeTimer();
            }
        }

        // Update video info when video loads
        if (event.data === YT.PlayerState.PLAYING || event.data === YT.PlayerState.PAUSED) {
            const videoData = this.player.getVideoData();
            if (videoData && videoData.title) {
                this.elements.currentVideoTitle.textContent = videoData.title;
            }
        }
    }

    // ==================== //
    // Playback Controls    //
    // ==================== //

    togglePlayPause() {
        if (!this.player || !this.playerReady) return;

        const state = this.player.getPlayerState();
        if (state === YT.PlayerState.PLAYING) {
            this.player.pauseVideo();
            this.trackEvent('playback_toggled', {action: 'pause'});
        } else {
            this.player.playVideo();
            this.trackEvent('playback_toggled', {action: 'play'});
        }
    }

    skipToStart() {
        if (!this.player || !this.playerReady) return;
        this.player.seekTo(0, true);
    }

    setSpeed(speed) {
        if (!this.player || !this.playerReady) return;

        this.player.setPlaybackRate(speed);
        this.elements.speedDisplay.textContent = `${speed.toFixed(2)}x`;

        // Track event
        this.trackEvent('speed_changed', {speed: speed});

        // Update preset buttons
        this.elements.speedPresets.forEach(btn => {
            const btnSpeed = parseFloat(btn.dataset.speed);
            if (Math.abs(btnSpeed - speed) < 0.01) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update mobile preset buttons
        document.querySelectorAll('.btn-preset-mobile').forEach(btn => {
            const btnSpeed = parseFloat(btn.dataset.speed);
            if (Math.abs(btnSpeed - speed) < 0.01) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update share URL with new speed
        this.updateShareUrl();

        // Update session stats speed display
        if (this._statCurrentSpeed) {
            this._statCurrentSpeed.textContent = speed.toFixed(2) + 'x';
        }
    }

    seek(seconds) {
        if (!this.player || !this.playerReady) return;

        const currentTime = this.player.getCurrentTime();
        const newTime = Math.max(0, currentTime + seconds);
        this.player.seekTo(newTime, true);
    }

    seekToPercent(percent) {
        if (!this.player || !this.playerReady) return;

        const duration = this.player.getDuration();
        const time = (percent / 100) * duration;
        this.player.seekTo(time, true);
    }

    // ==================== //
    // Loop Controls        //
    // ==================== //

    setLoopStart() {
        if (!this.player || !this.playerReady) return;

        this.loopStart = this.player.getCurrentTime();
        this.elements.loopStartDisplay.textContent = this.formatTime(this.loopStart);
        this.updateLoopUI();
        this.checkLoopButtonState();
        this.updateShareUrl();

        // Track event
        this.trackEvent('loop_start_set', {timestamp: this.loopStart});
    }

    setLoopEnd() {
        if (!this.player || !this.playerReady) return;

        this.loopEnd = this.player.getCurrentTime();
        this.elements.loopEndDisplay.textContent = this.formatTime(this.loopEnd);
        this.updateLoopUI();
        this.checkLoopButtonState();
        this.updateShareUrl();

        // Track event
        this.trackEvent('loop_end_set', {timestamp: this.loopEnd});
    }

    toggleLoop() {
        if (this.loopStart === null || this.loopEnd === null) return;

        this.loopEnabled = !this.loopEnabled;

        if (this.loopEnabled) {
            this.elements.toggleLoopBtn.textContent = 'Disable Loop';
            this.elements.toggleLoopBtn.classList.add('active');
            this.startLoopCheck();
            // Track event
            this.trackEvent('loop_enabled', {
                startTime: this.loopStart,
                endTime: this.loopEnd,
                duration: this.loopEnd - this.loopStart
            });
        } else {
            this.elements.toggleLoopBtn.textContent = 'Enable Loop';
            this.elements.toggleLoopBtn.classList.remove('active');
            this.stopLoopCheck();
            // Track event
            this.trackEvent('loop_disabled');
        }

        this.updateLoopUI();
    }

    clearLoop() {
        this.loopStart = null;
        this.loopEnd = null;
        this.loopEnabled = false;

        this.elements.loopStartDisplay.textContent = '--:--';
        this.elements.loopEndDisplay.textContent = '--:--';
        this.elements.toggleLoopBtn.textContent = 'Enable Loop';
        this.elements.toggleLoopBtn.classList.remove('active');

        // Reset loop rep count
        this._loopRepCount = 0;
        this.updateSessionStatsUI();

        this.stopLoopCheck();
        this.updateLoopUI();
        this.checkLoopButtonState();
        this.updateShareUrl();
    }

    checkLoopButtonState() {
        const canEnableLoop = this.loopStart !== null && this.loopEnd !== null && this.loopStart < this.loopEnd;
        this.elements.toggleLoopBtn.disabled = !canEnableLoop;
    }

    updateLoopUI() {
        const overlay = this.elements.loopOverlay;

        if (this.loopStart !== null && this.loopEnd !== null && this.player && this.playerReady) {
            const duration = this.player.getDuration();
            const startPercent = (this.loopStart / duration) * 100;
            const endPercent = (this.loopEnd / duration) * 100;

            overlay.style.left = `${startPercent}%`;
            overlay.style.width = `${endPercent - startPercent}%`;
            overlay.style.display = 'block';
        } else {
            overlay.style.display = 'none';
        }
    }

    startLoopCheck() {
        this.stopLoopCheck();
        this.loopCheckInterval = setInterval(() => {
            if (!this.player || !this.playerReady || !this.loopEnabled) return;

            const currentTime = this.player.getCurrentTime();
            if (currentTime >= this.loopEnd) {
                this.player.seekTo(this.loopStart, true);
                // Count loop repetitions (debounce with 500ms window)
                const now = Date.now();
                if (now - this._lastLoopSeekTime > 500) {
                    this._loopRepCount++;
                    this.updateSessionStatsUI();
                    // Progressive speed training: auto-increment after N reps
                    if (this._progressiveEnabled) {
                        this._progressiveRepsAtCurrentSpeed++;
                        this.updateProgressiveUI();
                        if (this._progressiveRepsAtCurrentSpeed >= this._progressiveRepsPerStep) {
                            this.progressiveSpeedUp();
                        }
                    }
                }
                this._lastLoopSeekTime = now;
            }
        }, 100); // Check every 100ms
    }

    stopLoopCheck() {
        if (this.loopCheckInterval) {
            clearInterval(this.loopCheckInterval);
            this.loopCheckInterval = null;
        }
    }

    // ==================== //
    // Time Updates         //
    // ==================== //

    startTimeUpdate() {
        this.stopTimeUpdate();
        this.timeUpdateInterval = setInterval(() => {
            if (!this.player || !this.playerReady) return;

            try {
                const currentTime = this.player.getCurrentTime();
                const duration = this.player.getDuration();

                // Update time displays
                this.elements.currentTime.textContent = this.formatTime(currentTime);
                this.elements.duration.textContent = this.formatTime(duration);

                // Update timeline
                const percent = (currentTime / duration) * 100;
                this.elements.timelineSlider.value = percent;
                this.elements.progressBar.style.width = `${percent}%`;
            } catch (e) {
                // Ignore errors when player is transitioning
            }
        }, 250); // Update every 250ms
    }

    stopTimeUpdate() {
        if (this.timeUpdateInterval) {
            clearInterval(this.timeUpdateInterval);
            this.timeUpdateInterval = null;
        }
    }

    formatTime(seconds) {
        if (!seconds || isNaN(seconds) || !isFinite(seconds)) {
            return '0:00';
        }

        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // ==================== //
    // Rendering            //
    // ==================== //

    renderVideoList() {
        if (this.videos.length === 0) {
            this.elements.videoList.innerHTML = '<p style="color: #6b7280; text-align: center; padding: 2rem;">No videos yet. Add your first practice video above!</p>';
            return;
        }

        this.elements.videoList.innerHTML = this.videos
            .map(video => {
                const title = video.title || 'Video';
                const date = new Date(video.addedAt).toLocaleDateString();
                return `
                    <div class="video-item ${this.currentVideoId === video.id ? 'active' : ''}" data-video-id="${video.id}">
                        <div class="video-item-header">
                            <h3>${this.escapeHtml(title)}</h3>
                            <button class="btn btn-danger" onclick="app.removeVideo('${video.id}')" aria-label="Remove video">×</button>
                        </div>
                        <div class="video-id">Added: ${date}</div>
                    </div>
                `;
            })
            .join('');

        // Add click listeners to video items
        document.querySelectorAll('.video-item').forEach(item => {
            const videoId = item.dataset.videoId;
            item.addEventListener('click', (e) => {
                // Don't select if clicking remove button
                if (!e.target.classList.contains('btn-danger')) {
                    this.selectVideo(videoId);
                }
            });
        });
    }

    // ==================== //
    // LocalStorage         //
    // ==================== //

    loadVideos() {
        try {
            const stored = localStorage.getItem('musicPracticeVideos');
            if (stored) {
                this.videos = JSON.parse(stored);
            }
        } catch (e) {
            console.error('Error loading videos from localStorage:', e);
            this.videos = [];
        }
    }

    saveVideos() {
        try {
            localStorage.setItem('musicPracticeVideos', JSON.stringify(this.videos));
        } catch (e) {
            console.error('Error saving videos to localStorage:', e);
        }
    }

    // ==================== //
    // Modal System         //
    // ==================== //

    // ==================== //
    // Welcome Banner       //
    // ==================== //

    showWelcomeBannerIfNeeded() {
        const dismissed = localStorage.getItem('musicPracticeOnboardingDismissed') === 'true';
        const banner = document.getElementById('welcomeBanner');
        if (!banner) return;

        if (dismissed || this.videos.length > 0) {
            banner.style.display = 'none';
        } else {
            this.trackEvent('welcome_banner_shown');
        }
    }

    dismissWelcomeBanner() {
        const banner = document.getElementById('welcomeBanner');
        if (banner) {
            banner.style.display = 'none';
        }
        localStorage.setItem('musicPracticeOnboardingDismissed', 'true');
        this.trackEvent('welcome_banner_dismissed');
    }

    showWelcomeModal() {
        const modal = this.createModal('welcome');
        modal.innerHTML = `
            <div class="modal-content welcome-modal">
                <button class="modal-close" onclick="app.closeModal('welcome')">&times;</button>
                <h2>Welcome to PracticeLoop! 🎵</h2>
                <p>Thanks for trying out this tool designed by musicians, for musicians.</p>

                <div class="benefits">
                    <div class="benefit">
                        <span class="benefit-icon">🎯</span>
                        <div>
                            <h3>Master Difficult Passages</h3>
                            <p>Slow down tricky sections to 25% speed without changing pitch. Practice at your own pace!</p>
                        </div>
                    </div>
                    <div class="benefit">
                        <span class="benefit-icon">🔁</span>
                        <div>
                            <h3>Perfect Your Timing with Loops</h3>
                            <p>Set precise loop points to repeat challenging measures over and over until you've got it.</p>
                        </div>
                    </div>
                    <div class="benefit">
                        <span class="benefit-icon">📚</span>
                        <div>
                            <h3>Build Your Practice Library</h3>
                            <p>Save all your practice videos in one place for instant access anytime you practice.</p>
                        </div>
                    </div>
                </div>

                <div class="account-info">
                    <p><strong>Free Account:</strong> 3 videos + 3 saved loops</p>
                    <p><strong>Referral Bonus:</strong> Share with friends to get 5 videos for 3 months!</p>
                    <p><strong>Paid Account:</strong> Unlimited videos forever</p>
                </div>

                <div class="modal-actions">
                    <button class="btn btn-primary" onclick="app.closeModal('welcome')">Get Started (Free)</button>
                    <a href="https://pay.tide.co/products/music-pract-dojo6MnC" target="_blank"
                       onclick="app.trackEvent('upgrade_link_clicked', {source: 'welcome'})"
                       class="btn btn-secondary">Upgrade to Unlimited</a>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        this.accountManager.setWelcomeShown();
        this.trackEvent('welcome_shown');
    }

    showUpgradeModal() {
        const videoLimit = this.accountManager.getVideoLimit();
        const isReferral = this.accountManager.accountType === 'referral';

        const modal = this.createModal('upgrade');
        modal.innerHTML = `
            <div class="modal-content upgrade-modal">
                <button class="modal-close" onclick="app.closeModal('upgrade')">&times;</button>
                <h2>You're practising! Keep going.</h2>
                <p>You've saved ${videoLimit} video${videoLimit > 1 ? 's' : ''} -- that's the limit on the free plan. Unlock unlimited to keep your practice library growing.</p>

                <div class="upgrade-features-list">
                    <div class="upgrade-feature-item"><span class="check-icon">&#10003;</span> Unlimited videos</div>
                    <div class="upgrade-feature-item"><span class="check-icon">&#10003;</span> Unlimited saved loops</div>
                    <div class="upgrade-feature-item"><span class="check-icon">&#10003;</span> Progressive speed training</div>
                    <div class="upgrade-feature-item"><span class="check-icon">&#10003;</span> One-time payment, yours forever</div>
                </div>

                <div class="upgrade-options">
                    <div class="upgrade-option upgrade-option-primary">
                        <a href="https://pay.tide.co/products/music-pract-dojo6MnC" target="_blank"
                           onclick="app.trackEvent('upgrade_link_clicked', {source: 'limit'})"
                           class="btn btn-primary btn-upgrade-main">Upgrade Now</a>
                        <span class="upgrade-price-hint">One-time purchase</span>
                    </div>

                    ${!isReferral ? `
                    <div class="upgrade-option upgrade-option-alt">
                        <p class="upgrade-or">or</p>
                        <button class="btn btn-share-earn" onclick="app.closeModal('upgrade'); app.showReferralModal();">Share with a friend for free bonus videos</button>
                    </div>
                    ` : ''}
                </div>

                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="app.closeModal('upgrade')">Maybe Later</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        this.trackEvent('video_add_blocked', { currentLimit: videoLimit });
    }

    showLicenseKeyModal() {
        const modal = this.createModal('license');
        modal.innerHTML = `
            <div class="modal-content license-modal">
                <button class="modal-close" onclick="app.closeModal('license')">&times;</button>
                <h2>Enter License Key</h2>
                <p>Enter your license key to unlock unlimited videos.</p>

                <input type="text" id="licenseKeyInput" placeholder="MUSIC-PRACTICE-XXXX-XXXX-XXXX"
                       class="license-input" maxlength="30">
                <div id="licenseError" class="error-message" style="display: none;"></div>

                <div class="modal-actions">
                    <button class="btn btn-primary" onclick="app.activateLicenseKey()">Activate</button>
                    <button class="btn btn-secondary" onclick="app.closeModal('license')">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    activateLicenseKey() {
        const input = document.getElementById('licenseKeyInput');
        const key = input.value.trim().toUpperCase();
        const error = document.getElementById('licenseError');

        if (this.accountManager.upgrade(key)) {
            this.trackEvent('license_key_entered', {success: true});
            this.trackEvent('account_upgraded');
            this.closeModal('license');
            alert('Success! Your account has been upgraded to unlimited videos.');
            this.updateAccountUI();
            this.identifyUser();
        } else {
            this.trackEvent('license_key_entered', {success: false});
            error.textContent = 'Invalid license key format. Please check and try again.';
            error.style.display = 'block';
        }
    }

    createModal(id) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = `modal-${id}`;
        return modal;
    }

    closeModal(id) {
        const modal = document.getElementById(`modal-${id}`);
        if (modal) {
            if (id === 'welcome') {
                this.trackEvent('welcome_dismissed');
            }
            modal.remove();
        }
    }

    updateAccountUI() {
        const accountBadge = document.getElementById('accountBadge');
        if (accountBadge) {
            const accountType = this.accountManager.accountType;
            if (accountType === 'paid') {
                accountBadge.textContent = 'Unlimited';
                accountBadge.className = 'account-badge paid';
            } else if (accountType === 'referral' && this.accountManager.isReferralActive()) {
                const days = this.accountManager.getRemainingReferralDays();
                accountBadge.textContent = `Referral (5 videos, ${days}d left)`;
                accountBadge.className = 'account-badge referral';
            } else {
                accountBadge.textContent = 'Free (3 videos)';
                accountBadge.className = 'account-badge free';
            }
        }

        const buyLink = document.getElementById('buyLicenseLink');
        if (buyLink) {
            buyLink.style.display = this.accountManager.isPaid() ? 'none' : 'inline-block';
        }

        const licenseLink = document.getElementById('licenseKeyLink');
        if (licenseLink) {
            licenseLink.style.display = this.accountManager.isPaid() ? 'none' : 'inline-block';
        }

        const shareBtn = document.getElementById('shareReferralBtn');
        if (shareBtn) {
            // Show Share & Earn for free users, hide for paid (they can still share if they want via other means)
            shareBtn.style.display = this.accountManager.isPaid() ? 'none' : 'inline-flex';
        }
    }

    // ==================== //
    // Referral System UI   //
    // ==================== //

    async showReferralModal() {
        const code = await this.accountManager.generateReferralCode();
        const referralLink = `${window.location.origin}${window.location.pathname}?ref=${code}`;

        const modal = this.createModal('referral');
        modal.innerHTML = `
            <div class="modal-content referral-modal">
                <button class="modal-close" onclick="app.closeModal('referral')">&times;</button>
                <h2>Share & Earn Free Videos</h2>
                <p>Share your link with friends. When they sign up and add their first video, you'll get <strong>5 videos for 3 months</strong>!</p>

                <div class="referral-link-box">
                    <input type="text" id="referralLinkInput" value="${referralLink}" readonly>
                    <button class="btn btn-primary" onclick="app.copyReferralLink()">Copy</button>
                </div>

                <div class="share-buttons">
                    <button class="btn btn-share btn-whatsapp" onclick="app.shareVia('whatsapp')">
                        <span>WhatsApp</span>
                    </button>
                    <button class="btn btn-share btn-twitter" onclick="app.shareVia('twitter')">
                        <span>Twitter</span>
                    </button>
                    <button class="btn btn-share btn-email" onclick="app.shareVia('email')">
                        <span>Email</span>
                    </button>
                </div>

                <div class="referral-info">
                    <p><strong>Your referral code:</strong> ${code}</p>
                    ${this.accountManager.isReferralActive()
                        ? `<p class="referral-status active">You have ${this.accountManager.getRemainingReferralDays()} days of referral benefits remaining!</p>`
                        : '<p class="referral-status">Share to unlock 5 videos for 3 months</p>'
                    }
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        this.trackEvent('referral_modal_opened');
    }

    copyReferralLink() {
        const input = document.getElementById('referralLinkInput');
        input.select();
        input.setSelectionRange(0, 99999); // Mobile support

        try {
            navigator.clipboard.writeText(input.value);
            this.trackEvent('referral_link_copied');

            // Visual feedback
            const btn = input.nextElementSibling;
            const originalText = btn.textContent;
            btn.textContent = 'Copied!';
            btn.classList.add('copied');
            setTimeout(() => {
                btn.textContent = originalText;
                btn.classList.remove('copied');
            }, 2000);
        } catch (e) {

        }
    }

    shareVia(platform) {
        const code = this.accountManager.getReferralCode();
        const referralLink = `${window.location.origin}${window.location.pathname}?ref=${code}`;
        const text = "I've been using this awesome music practice tool to slow down songs and loop tricky sections. Try it out!";

        let shareUrl;
        switch (platform) {
            case 'whatsapp':
                shareUrl = `https://wa.me/?text=${encodeURIComponent(text + ' ' + referralLink)}`;
                break;
            case 'twitter':
                shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(referralLink)}`;
                break;
            case 'email':
                shareUrl = `mailto:?subject=${encodeURIComponent('Check out this music practice tool!')}&body=${encodeURIComponent(text + '\n\n' + referralLink)}`;
                break;
            default:
                return;
        }

        this.trackEvent('referral_shared', { platform });
        window.open(shareUrl, '_blank');
    }

    async recordReferralSignup() {
        const referredBy = this.accountManager.getReferredBy();
        if (!referredBy) return;

        try {
            const response = await fetch('/.netlify/functions/record-referral', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    referrerCode: referredBy,
                    newUserId: this.accountManager.userId
                })
            });

            if (response.ok) {
                this.trackEvent('referral_signup_recorded', { referrerCode: referredBy });
            }
        } catch (e) {

        }
    }

    async checkAndApplyReferralReward() {
        // This can be called to check if the user has earned a referral reward
        try {
            const response = await fetch(`/.netlify/functions/check-referral-status?userId=${this.accountManager.userId}`);
            if (response.ok) {
                const data = await response.json();
                if (data.hasReward && this.accountManager.accountType === 'free') {
                    this.accountManager.upgradeToReferral();
                    this.updateAccountUI();
                    this.trackEvent('referral_reward_applied');
                    alert('Congratulations! A friend signed up using your link. You now have 5 videos for 3 months!');
                }
            }
        } catch (e) {

        }
    }

    // ==================== //
    // Practice Timer        //
    // ==================== //

    initPracticeTimer() {
        // Load today's existing practice time from localStorage
        const log = this.getPracticeLog();
        const todayKey = this.getTodayKey();
        const existingMinutes = log[todayKey] || 0;

        // DOM references for timer/stats
        this._timerChip = document.getElementById('practiceTimer');
        this._statSessionTime = document.getElementById('statSessionTime');
        this._statTodayTotal = document.getElementById('statTodayTotal');
        this._statLoopReps = document.getElementById('statLoopReps');
        this._statCurrentSpeed = document.getElementById('statCurrentSpeed');
        this._streakIndicator = document.getElementById('streakIndicator');
        this._streakText = document.getElementById('streakText');
        this._sessionStatsSection = document.getElementById('sessionStatsSection');

        // Update today total display with existing time
        if (this._statTodayTotal) {
            this._statTodayTotal.textContent = this.formatTimerMinSec(existingMinutes * 60);
        }

        // Calculate and display streak
        this.updateStreakDisplay();

        // Bind collapsible toggle
        const toggle = document.getElementById('sessionStatsToggle');
        const body = document.getElementById('sessionStatsBody');
        if (toggle && body) {
            toggle.addEventListener('click', () => {
                toggle.classList.toggle('open');
                body.classList.toggle('open');
            });
        }

        // Save practice time periodically (every 30s) and on page unload
        this._practiceStatsInterval = setInterval(() => this.savePracticeTime(), 30000);
        window.addEventListener('beforeunload', () => this.savePracticeTime());
    }

    startPracticeTimer() {
        if (this._practiceTimerRunning) return;
        this._practiceTimerRunning = true;

        // Show session stats section when user starts playing
        if (this._sessionStatsSection) {
            this._sessionStatsSection.style.display = 'block';
        }

        // Add active class to timer chip
        if (this._timerChip) {
            this._timerChip.classList.add('active');
        }

        this._practiceTimerInterval = setInterval(() => {
            this._practiceTimerSeconds++;
            this.updateTimerDisplay();

            // Update session stats every 5 seconds
            if (this._practiceTimerSeconds % 5 === 0) {
                this.updateSessionStatsUI();
            }
        }, 1000);
    }

    pausePracticeTimer() {
        if (!this._practiceTimerRunning) return;
        this._practiceTimerRunning = false;

        if (this._practiceTimerInterval) {
            clearInterval(this._practiceTimerInterval);
            this._practiceTimerInterval = null;
        }

        // Remove active class from timer chip
        if (this._timerChip) {
            this._timerChip.classList.remove('active');
        }

        // Save immediately on pause
        this.savePracticeTime();
    }

    updateTimerDisplay() {
        const display = this.formatTimerMinSec(this._practiceTimerSeconds);

        // Update the chip near speed controls
        if (this._timerChip) {
            this._timerChip.textContent = display;
        }

        // Update session time stat card
        if (this._statSessionTime) {
            this._statSessionTime.textContent = display;
        }
    }

    updateSessionStatsUI() {
        // Today total = existing stored minutes + current session seconds
        const log = this.getPracticeLog();
        const todayKey = this.getTodayKey();
        const existingSeconds = (log[todayKey] || 0) * 60;
        const todayTotal = existingSeconds + this._practiceTimerSeconds;

        if (this._statTodayTotal) {
            this._statTodayTotal.textContent = this.formatTimerMinSec(todayTotal);
        }

        if (this._statLoopReps) {
            this._statLoopReps.textContent = this._loopRepCount;
        }

        if (this._statCurrentSpeed && this.player && this.playerReady) {
            try {
                this._statCurrentSpeed.textContent = this.player.getPlaybackRate().toFixed(2) + 'x';
            } catch (e) { /* ignore */ }
        }
    }

    formatTimerMinSec(totalSeconds) {
        const mins = Math.floor(totalSeconds / 60);
        const secs = Math.floor(totalSeconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // ==================== //
    // Practice Persistence  //
    // ==================== //

    getTodayKey() {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    getPracticeLog() {
        try {
            const stored = localStorage.getItem('practiceLog');
            return stored ? JSON.parse(stored) : {};
        } catch (e) {
            return {};
        }
    }

    savePracticeTime() {
        if (this._practiceTimerSeconds < 1) return;

        const log = this.getPracticeLog();
        const todayKey = this.getTodayKey();
        const existingMinutes = log[todayKey] || 0;
        // Add current session seconds converted to minutes (fractional)
        const sessionMinutes = this._practiceTimerSeconds / 60;

        // We store the total for today. Since we keep adding, reset session counter
        // after saving to avoid double-counting.
        log[todayKey] = existingMinutes + sessionMinutes;

        // Prune entries older than 30 days
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);
        for (const key of Object.keys(log)) {
            if (new Date(key) < cutoff) {
                delete log[key];
            }
        }

        try {
            localStorage.setItem('practiceLog', JSON.stringify(log));
        } catch (e) {
            console.error('Error saving practice log:', e);
        }

        // Reset session counter since we just persisted it
        this._practiceTimerSeconds = 0;

        // Update streak display after save
        this.updateStreakDisplay();
    }

    calculateStreak() {
        const log = this.getPracticeLog();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let streak = 0;
        let checkDate = new Date(today);

        // If user has practiced today (either stored or current session > 0), count today
        const todayKey = this.getTodayKey();
        const hasTodayPractice = (log[todayKey] && log[todayKey] > 0) || this._practiceTimerSeconds > 0;

        if (!hasTodayPractice) {
            // Check if they practiced yesterday (streak still valid, just haven't started today)
            checkDate.setDate(checkDate.getDate() - 1);
            const yesterdayKey = this.formatDateKey(checkDate);
            if (!log[yesterdayKey] || log[yesterdayKey] <= 0) {
                return 0;
            }
            streak = 1;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            streak = 1;
            checkDate.setDate(checkDate.getDate() - 1);
        }

        // Count consecutive days backwards
        while (true) {
            const key = this.formatDateKey(checkDate);
            if (log[key] && log[key] > 0) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }

        return streak;
    }

    formatDateKey(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    updateStreakDisplay() {
        const streak = this.calculateStreak();

        if (this._streakIndicator && this._streakText) {
            if (streak >= 3) {
                this._streakIndicator.style.display = 'flex';
                this._streakText.textContent = `${streak} day streak!`;
            } else {
                this._streakIndicator.style.display = 'none';
            }
        }
    }

    // ==================== //
    // Saved Loops           //
    // ==================== //

    getSavedLoops(videoId) {
        try {
            const stored = localStorage.getItem(`musicPracticeLoops_${videoId}`);
            return stored ? JSON.parse(stored) : [];
        } catch(e) { return []; }
    }

    getAllSavedLoopsCount() {
        let total = 0;
        this.videos.forEach(v => {
            total += this.getSavedLoops(v.id).length;
        });
        return total;
    }

    saveLoop(videoId, name, start, end) {
        const isPaid = this.accountManager.isPaid();
        if (!isPaid && this.getAllSavedLoopsCount() >= 3) {
            this.showSaveLoopUpgradeModal();
            return false;
        }
        const loops = this.getSavedLoops(videoId);
        loops.push({ name: name || `Loop ${loops.length + 1}`, start, end, savedAt: Date.now() });
        localStorage.setItem(`musicPracticeLoops_${videoId}`, JSON.stringify(loops));
        this.renderSavedLoops(videoId);
        this.trackEvent('loop_saved', { videoId, name, duration: end - start });
        return true;
    }

    deleteSavedLoop(videoId, index) {
        const loops = this.getSavedLoops(videoId);
        loops.splice(index, 1);
        localStorage.setItem(`musicPracticeLoops_${videoId}`, JSON.stringify(loops));
        this.renderSavedLoops(videoId);
    }

    loadSavedLoop(loop) {
        this.loopStart = loop.start;
        this.loopEnd = loop.end;
        this.elements.loopStartDisplay.textContent = this.formatTime(loop.start);
        this.elements.loopEndDisplay.textContent = this.formatTime(loop.end);
        this.updateLoopUI();
        this.checkLoopButtonState();
        this.updateShareUrl();
        if (this.player && this.playerReady) {
            this.player.seekTo(loop.start, true);
        }
        this.trackEvent('saved_loop_loaded', { name: loop.name });
    }

    renderSavedLoops(videoId) {
        const container = document.getElementById('savedLoopsContainer');
        if (!container) return;
        const loops = this.getSavedLoops(videoId);
        const isPaid = this.accountManager.isPaid();
        const totalCount = this.getAllSavedLoopsCount();

        if (loops.length === 0) {
            container.innerHTML = '<p class="no-loops-hint">No saved loops yet. Set a loop and click "Save Loop" to keep it.</p>';
            return;
        }

        container.innerHTML = loops.map((loop, i) => `
            <div class="saved-loop-item">
                <div class="saved-loop-info">
                    <span class="saved-loop-name">${this.escapeHtml(loop.name)}</span>
                    <span class="saved-loop-times">${this.formatTime(loop.start)} - ${this.formatTime(loop.end)}</span>
                </div>
                <div class="saved-loop-actions">
                    <button class="btn btn-loop-load" onclick="app.loadSavedLoop(${JSON.stringify(loop).replace(/"/g, '&quot;')})">Load</button>
                    <button class="btn btn-loop-delete" onclick="app.deleteSavedLoop('${videoId}', ${i})">x</button>
                </div>
            </div>
        `).join('');

        // Update save button state
        const saveBtn = document.getElementById('saveLoopBtn');
        if (saveBtn && !isPaid) {
            saveBtn.disabled = totalCount >= 3;
            if (totalCount >= 3) {
                saveBtn.title = 'Upgrade to save more loops';
            }
        }
    }

    doSaveLoop() {
        if (this.loopStart === null || this.loopEnd === null || this.loopStart >= this.loopEnd) {
            alert('Please set a valid loop start and end point first.');
            return;
        }
        const nameInput = document.getElementById('loopNameInput');
        const name = nameInput ? nameInput.value.trim() : '';
        const success = this.saveLoop(this.currentVideoId, name, this.loopStart, this.loopEnd);
        if (success && nameInput) nameInput.value = '';
    }

    showSaveLoopUpgradeModal() {
        const modal = this.createModal('saveloop-upgrade');
        modal.innerHTML = `
            <div class="modal-content upgrade-modal">
                <button class="modal-close" onclick="app.closeModal('saveloop-upgrade')">&times;</button>
                <h2>Save More Loops</h2>
                <p>Free accounts can save up to 3 loops. Upgrade to save unlimited loops across all your practice videos.</p>
                <div class="modal-actions">
                    <a href="https://pay.tide.co/products/music-pract-dojo6MnC" target="_blank"
                       onclick="app.trackEvent('upgrade_link_clicked', {source: 'loop_limit'})"
                       class="btn btn-primary">Upgrade Now</a>
                    <button class="btn btn-secondary" onclick="app.closeModal('saveloop-upgrade')">Maybe Later</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // ==================== //
    // Metronome            //
    // ==================== //

    initMetronome() {
        // DOM references
        this._metronomeBpmInput = document.getElementById('metronomeBpmInput');
        this._metronomeTimeSigSelect = document.getElementById('metronomeTimeSig');
        this._metronomeTapBtn = document.getElementById('metronomeTapBtn');
        this._metronomeStartStopBtn = document.getElementById('metronomeStartStopBtn');
        this._metronomeBeatDot = document.getElementById('metronomeBeatDot');
        this._metronomeVolumeSlider = document.getElementById('metronomeVolume');
        this._metronomeToggle = document.getElementById('metronomeToggle');
        this._metronomeBodyEl = document.getElementById('metronomeBody');

        if (!this._metronomeToggle) return;

        // Collapsible toggle (starts collapsed)
        this._metronomeToggle.addEventListener('click', () => {
            this._metronomeToggle.classList.toggle('open');
            this._metronomeBodyEl.classList.toggle('open');
        });

        // BPM input
        if (this._metronomeBpmInput) {
            this._metronomeBpmInput.addEventListener('change', () => {
                let val = parseInt(this._metronomeBpmInput.value, 10);
                if (isNaN(val) || val < 20) val = 20;
                if (val > 300) val = 300;
                this._metronomeBpmInput.value = val;
                this._metronomeBpm = val;
            });
        }

        // Time signature
        if (this._metronomeTimeSigSelect) {
            this._metronomeTimeSigSelect.addEventListener('change', () => {
                const val = this._metronomeTimeSigSelect.value;
                const parts = val.split('/');
                this._metronomeTimeSig = [parseInt(parts[0], 10), parseInt(parts[1], 10)];
                this._metronomeBeatCount = 0;
            });
        }

        // Volume slider
        if (this._metronomeVolumeSlider) {
            this._metronomeVolumeSlider.addEventListener('input', () => {
                this._metronomeVolume = parseInt(this._metronomeVolumeSlider.value, 10) / 100;
            });
        }

        // Start/Stop button
        if (this._metronomeStartStopBtn) {
            this._metronomeStartStopBtn.addEventListener('click', () => {
                if (this._metronomeRunning) {
                    this.metronomeStop();
                } else {
                    this.metronomeStart();
                }
            });
        }

        // Tap tempo button
        if (this._metronomeTapBtn) {
            this._metronomeTapBtn.addEventListener('click', () => {
                this.metronomeTap();
            });
        }
    }

    metronomeEnsureAudioContext() {
        if (!this._metronomeAudioCtx) {
            this._metronomeAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this._metronomeAudioCtx.state === 'suspended') {
            this._metronomeAudioCtx.resume();
        }
        return this._metronomeAudioCtx;
    }

    metronomeStart() {
        const ctx = this.metronomeEnsureAudioContext();
        this._metronomeRunning = true;
        this._metronomeBeatCount = 0;
        this._metronomeNextNoteTime = ctx.currentTime;

        // Start the scheduler loop
        this.metronomeScheduler();

        // Update UI
        if (this._metronomeStartStopBtn) {
            this._metronomeStartStopBtn.textContent = 'Stop';
            this._metronomeStartStopBtn.classList.add('running');
        }

        this.trackEvent('metronome_started', { bpm: this._metronomeBpm, timeSig: this._metronomeTimeSig.join('/') });
    }

    metronomeStop() {
        this._metronomeRunning = false;

        if (this._metronomeSchedulerTimer) {
            clearTimeout(this._metronomeSchedulerTimer);
            this._metronomeSchedulerTimer = null;
        }

        // Clear visual beat
        if (this._metronomeBeatDot) {
            this._metronomeBeatDot.classList.remove('flash', 'flash-downbeat');
        }

        // Update UI
        if (this._metronomeStartStopBtn) {
            this._metronomeStartStopBtn.textContent = 'Start';
            this._metronomeStartStopBtn.classList.remove('running');
        }

        this.trackEvent('metronome_stopped');
    }

    metronomeScheduler() {
        if (!this._metronomeRunning) return;

        const ctx = this._metronomeAudioCtx;

        // Schedule notes that fall within the lookahead window
        while (this._metronomeNextNoteTime < ctx.currentTime + this._metronomeScheduleAheadTime) {
            this.metronomeScheduleNote(this._metronomeNextNoteTime, this._metronomeBeatCount);
            this.metronomeAdvanceBeat();
        }

        this._metronomeSchedulerTimer = setTimeout(() => this.metronomeScheduler(), this._metronomeLookahead);
    }

    metronomeScheduleNote(time, beatNumber) {
        const ctx = this._metronomeAudioCtx;
        const beatsPerMeasure = this._metronomeTimeSig[0];
        const isDownbeat = (beatNumber % beatsPerMeasure) === 0;

        // Create click sound using OscillatorNode
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        // Different pitch for downbeat vs other beats
        if (isDownbeat) {
            osc.frequency.value = 1000; // Higher pitch for downbeat
        } else {
            osc.frequency.value = 800; // Lower pitch for other beats
        }

        osc.type = 'sine';

        // Volume envelope - short click
        const volume = this._metronomeVolume;
        gainNode.gain.setValueAtTime(volume, time);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

        osc.start(time);
        osc.stop(time + 0.05);

        // Schedule visual flash
        const delay = Math.max(0, (time - ctx.currentTime) * 1000);
        setTimeout(() => {
            this.metronomeFlashBeat(isDownbeat);
        }, delay);
    }

    metronomeAdvanceBeat() {
        const secondsPerBeat = 60.0 / this._metronomeBpm;
        this._metronomeNextNoteTime += secondsPerBeat;
        this._metronomeBeatCount++;
    }

    metronomeFlashBeat(isDownbeat) {
        if (!this._metronomeBeatDot) return;

        // Remove any existing flash classes
        this._metronomeBeatDot.classList.remove('flash', 'flash-downbeat');

        // Force reflow to restart animation
        void this._metronomeBeatDot.offsetWidth;

        // Add the appropriate flash class
        if (isDownbeat) {
            this._metronomeBeatDot.classList.add('flash-downbeat');
        } else {
            this._metronomeBeatDot.classList.add('flash');
        }

        // Remove flash after a short duration
        setTimeout(() => {
            if (this._metronomeBeatDot) {
                this._metronomeBeatDot.classList.remove('flash', 'flash-downbeat');
            }
        }, 100);
    }

    metronomeTap() {
        const now = Date.now();

        // Reset if gap > 2 seconds
        if (this._metronomeTapTimes.length > 0) {
            const lastTap = this._metronomeTapTimes[this._metronomeTapTimes.length - 1];
            if (now - lastTap > 2000) {
                this._metronomeTapTimes = [];
            }
        }

        this._metronomeTapTimes.push(now);

        // Keep only last 8 taps
        if (this._metronomeTapTimes.length > 8) {
            this._metronomeTapTimes.shift();
        }

        // Need at least 2 taps to calculate BPM
        if (this._metronomeTapTimes.length >= 2) {
            const intervals = [];
            for (let i = 1; i < this._metronomeTapTimes.length; i++) {
                intervals.push(this._metronomeTapTimes[i] - this._metronomeTapTimes[i - 1]);
            }
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            let bpm = Math.round(60000 / avgInterval);

            // Clamp to valid range
            bpm = Math.max(20, Math.min(300, bpm));

            this._metronomeBpm = bpm;
            if (this._metronomeBpmInput) {
                this._metronomeBpmInput.value = bpm;
            }
        }
    }
    // ==================== //
    // Progressive Speed    //
    // ==================== //

    initProgressiveTraining() {
        const toggle = document.getElementById('progressiveToggle');
        const repsInput = document.getElementById('progressiveReps');
        const stepInput = document.getElementById('progressiveStep');
        const targetInput = document.getElementById('progressiveTarget');

        if (toggle) {
            toggle.addEventListener('change', () => {
                this._progressiveEnabled = toggle.checked;
                this._progressiveRepsAtCurrentSpeed = 0;
                const controls = document.getElementById('progressiveControls');
                if (controls) controls.style.display = toggle.checked ? 'flex' : 'none';
                this.updateProgressiveUI();
                this.trackEvent('progressive_toggled', { enabled: toggle.checked });
            });
        }
        if (repsInput) {
            repsInput.addEventListener('change', () => {
                this._progressiveRepsPerStep = Math.max(1, Math.min(20, parseInt(repsInput.value) || 3));
                repsInput.value = this._progressiveRepsPerStep;
            });
        }
        if (stepInput) {
            stepInput.addEventListener('change', () => {
                this._progressiveSpeedStep = Math.max(0.01, Math.min(0.25, parseFloat(stepInput.value) || 0.05));
                stepInput.value = this._progressiveSpeedStep;
            });
        }
        if (targetInput) {
            targetInput.addEventListener('change', () => {
                this._progressiveTargetSpeed = Math.max(0.25, Math.min(2, parseFloat(targetInput.value) || 1.0));
                targetInput.value = this._progressiveTargetSpeed;
            });
        }
    }

    progressiveSpeedUp() {
        if (!this.player || !this.playerReady) return;

        const currentSpeed = this.player.getPlaybackRate();
        const newSpeed = Math.min(this._progressiveTargetSpeed, currentSpeed + this._progressiveSpeedStep);

        // Round to 2 decimal places to avoid floating point drift
        const rounded = Math.round(newSpeed * 100) / 100;

        if (rounded > currentSpeed) {
            this.setSpeed(rounded);
            this.elements.speedSlider.value = rounded;
            this._progressiveRepsAtCurrentSpeed = 0;
            this.showProgressiveNotification(rounded);
            this.trackEvent('progressive_speed_up', { newSpeed: rounded, targetSpeed: this._progressiveTargetSpeed });
        }

        // Check if we've reached the target
        if (rounded >= this._progressiveTargetSpeed) {
            this._progressiveEnabled = false;
            const toggle = document.getElementById('progressiveToggle');
            if (toggle) toggle.checked = false;
            const controls = document.getElementById('progressiveControls');
            if (controls) controls.style.display = 'none';
            this.showProgressiveComplete();
            this.trackEvent('progressive_target_reached', { targetSpeed: this._progressiveTargetSpeed });
        }

        this.updateProgressiveUI();
    }

    showProgressiveNotification(speed) {
        const notification = document.createElement('div');
        notification.className = 'progressive-notification';
        notification.textContent = `Speed up! Now at ${speed.toFixed(2)}x`;
        document.body.appendChild(notification);
        // Trigger animation
        requestAnimationFrame(() => notification.classList.add('show'));
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 1500);
    }

    showProgressiveComplete() {
        const notification = document.createElement('div');
        notification.className = 'progressive-notification progressive-complete';
        notification.textContent = `Target speed reached! You did it!`;
        document.body.appendChild(notification);
        requestAnimationFrame(() => notification.classList.add('show'));
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    updateProgressiveUI() {
        const progress = document.getElementById('progressiveProgress');
        const statusText = document.getElementById('progressiveStatus');
        if (!progress || !statusText) return;

        if (!this._progressiveEnabled) {
            progress.style.width = '0%';
            statusText.textContent = '';
            return;
        }

        const pct = Math.min(100, (this._progressiveRepsAtCurrentSpeed / this._progressiveRepsPerStep) * 100);
        progress.style.width = pct + '%';

        const currentSpeed = this.player && this.playerReady ? this.player.getPlaybackRate() : 0;
        const repsLeft = this._progressiveRepsPerStep - this._progressiveRepsAtCurrentSpeed;
        statusText.textContent = `${repsLeft} rep${repsLeft !== 1 ? 's' : ''} at ${currentSpeed.toFixed(2)}x until speed up`;
    }
}

// ==================== //
// Initialize App       //
// ==================== //

let app;

// YouTube API callback - called by the YouTube IFrame API script when loaded
function onYouTubeIframeAPIReady() {
    if (app) {
        app.onYouTubeAPIReady();
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        app = new MusicPracticeApp();
    });
} else {
    app = new MusicPracticeApp();
}
