// ==================== //
// YouTube Player App   //
// ==================== //

// Account Manager Class
class AccountManager {
    constructor() {
        this.accountType = this.getAccountType();
        this.licenseKey = this.getLicenseKey();
        this.welcomeShown = this.getWelcomeShown();
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
        // Load videos from localStorage
        this.loadVideos();
        this.renderVideoList();

        // Bind event listeners
        this.bindEvents();

        // Show search if API key available
        if (this.youtubeApiKey) {
            this.elements.searchSection.style.display = 'block';
        }

        // Show welcome modal for first-time users
        if (!this.accountManager.welcomeShown) {
            this.showWelcomeModal();
        }

        // Initialize analytics
        this.identifyUser();
        this.trackEvent('page_loaded', {
            hasApiKey: !!this.youtubeApiKey
        });

        // Set account created date if not set
        if (!localStorage.getItem('musicPracticeAccountCreated')) {
            localStorage.setItem('musicPracticeAccountCreated', new Date().toISOString());
        }

        // Update account UI
        this.updateAccountUI();

        // YouTube API will call onYouTubeIframeAPIReady when ready
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
            console.log('📊 Heap event:', eventName, eventData);
            window.heap.track(eventName, eventData);
        } else {
            console.warn('⚠️ Heap not available. Event not tracked:', eventName);
        }
    }

    identifyUser() {
        if (window.heap && typeof window.heap.addUserProperties === 'function') {
            const userData = {
                accountType: this.accountManager.accountType,
                videoCount: this.videos.length,
                hasYouTubeApiKey: !!this.youtubeApiKey
            };
            console.log('👤 Heap identify:', userData);
            window.heap.addUserProperties(userData);
        } else {
            console.warn('⚠️ Heap not available. User not identified.');
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

        // Check free account video limit
        console.log('Video limit check:', {
            isPaid: this.accountManager.isPaid(),
            videoCount: this.videos.length,
            accountType: this.accountManager.accountType,
            shouldBlock: !this.accountManager.isPaid() && this.videos.length >= 1
        });

        if (!this.accountManager.isPaid() && this.videos.length >= 1) {
            console.log('Blocking video add - showing upgrade modal');
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

        // Clear input
        this.elements.videoUrlInput.value = '';

        // Confetti!
        if (window.confetti) {
            confetti.burst();
        }

        // Track event
        this.trackEvent('video_added', {
            method: videoId && videoTitle ? 'search' : 'url',
            videoId: videoId
        });

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
            console.log('Could not fetch video title:', e);
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
            console.error('Search error:', e);
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

    createPlayer(videoId) {
        if (!window.YT) {
            console.error('YouTube API not loaded yet');
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
        console.log('Player ready');

        // Start time update interval
        this.startTimeUpdate();

        // Update video title if possible
        if (this.player && this.player.getVideoData) {
            const videoData = this.player.getVideoData();
            if (videoData && videoData.title) {
                this.elements.currentVideoTitle.textContent = videoData.title;
            }
        }
    }

    onPlayerStateChange(event) {
        // Update play/pause button
        if (event.data === YT.PlayerState.PLAYING) {
            this.elements.playPauseBtn.classList.add('playing');
        } else {
            this.elements.playPauseBtn.classList.remove('playing');
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

        // Track event
        this.trackEvent('loop_start_set', {timestamp: this.loopStart});
    }

    setLoopEnd() {
        if (!this.player || !this.playerReady) return;

        this.loopEnd = this.player.getCurrentTime();
        this.elements.loopEndDisplay.textContent = this.formatTime(this.loopEnd);
        this.updateLoopUI();
        this.checkLoopButtonState();

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

        this.stopLoopCheck();
        this.updateLoopUI();
        this.checkLoopButtonState();
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

    showWelcomeModal() {
        const modal = this.createModal('welcome');
        modal.innerHTML = `
            <div class="modal-content welcome-modal">
                <button class="modal-close" onclick="app.closeModal('welcome')">&times;</button>
                <h2>Welcome to Your Music Practice Tool! 🎵</h2>
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
                    <p><strong>Free Account:</strong> 1 video</p>
                    <p><strong>Paid Account:</strong> Unlimited videos</p>
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
        const modal = this.createModal('upgrade');
        modal.innerHTML = `
            <div class="modal-content upgrade-modal">
                <button class="modal-close" onclick="app.closeModal('upgrade')">&times;</button>
                <h2>Upgrade to Unlimited Videos</h2>
                <p>You're on a free account. Free accounts can save 1 video at a time.</p>
                <p><strong>Upgrade to unlimited videos and unlimited practice!</strong></p>

                <div class="modal-actions">
                    <a href="https://pay.tide.co/products/music-pract-dojo6MnC" target="_blank"
                       onclick="app.trackEvent('upgrade_link_clicked', {source: 'limit'})"
                       class="btn btn-primary">Upgrade Now</a>
                    <button class="btn btn-secondary" onclick="app.closeModal('upgrade')">Maybe Later</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        this.trackEvent('video_add_blocked');
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
            accountBadge.textContent = this.accountManager.isPaid() ? 'Unlimited' : 'Free (1 video)';
            accountBadge.className = this.accountManager.isPaid() ? 'account-badge paid' : 'account-badge free';
        }

        const buyLink = document.getElementById('buyLicenseLink');
        if (buyLink) {
            buyLink.style.display = this.accountManager.isPaid() ? 'none' : 'inline-block';
        }

        const licenseLink = document.getElementById('licenseKeyLink');
        if (licenseLink) {
            licenseLink.style.display = this.accountManager.isPaid() ? 'none' : 'inline-block';
        }
    }
}

// ==================== //
// Initialize App       //
// ==================== //

let app;

// YouTube API callback
function onYouTubeIframeAPIReady() {
    console.log('YouTube API ready');
    // App is already initialized, just note that API is ready
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        app = new MusicPracticeApp();
    });
} else {
    app = new MusicPracticeApp();
}
