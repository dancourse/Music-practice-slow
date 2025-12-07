// ==================== //
// YouTube Player App   //
// ==================== //

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

        // DOM Elements
        this.elements = {
            videoUrlInput: document.getElementById('videoUrlInput'),
            addVideoBtn: document.getElementById('addVideoBtn'),
            videoList: document.getElementById('videoList'),
            playerSection: document.getElementById('playerSection'),
            currentVideoTitle: document.getElementById('currentVideoTitle'),
            playPauseBtn: document.getElementById('playPauseBtn'),
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
            loopEndDisplay: document.getElementById('loopEndDisplay')
        };

        this.init();
    }

    init() {
        // Load videos from localStorage
        this.loadVideos();
        this.renderVideoList();

        // Bind event listeners
        this.bindEvents();

        // YouTube API will call onYouTubeIframeAPIReady when ready
    }

    bindEvents() {
        // Add video
        this.elements.addVideoBtn.addEventListener('click', () => this.addVideo());
        this.elements.videoUrlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addVideo();
        });

        // Playback controls
        this.elements.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
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

    addVideo() {
        const url = this.elements.videoUrlInput.value.trim();
        if (!url) {
            alert('Please enter a YouTube URL');
            return;
        }

        const videoId = this.extractVideoId(url);
        if (!videoId) {
            alert('Invalid YouTube URL. Please check and try again.');
            return;
        }

        // Check if video already exists
        if (this.videos.find(v => v.id === videoId)) {
            alert('This video is already in your library');
            return;
        }

        // Add video
        const video = {
            id: videoId,
            addedAt: Date.now()
        };

        this.videos.push(video);
        this.saveVideos();
        this.renderVideoList();

        // Clear input
        this.elements.videoUrlInput.value = '';

        // Auto-select if first video
        if (this.videos.length === 1) {
            this.selectVideo(videoId);
        }
    }

    removeVideo(videoId) {
        if (confirm('Remove this video from your library?')) {
            this.videos = this.videos.filter(v => v.id !== videoId);
            this.saveVideos();
            this.renderVideoList();

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
        } else {
            this.player.playVideo();
        }
    }

    setSpeed(speed) {
        if (!this.player || !this.playerReady) return;

        this.player.setPlaybackRate(speed);
        this.elements.speedDisplay.textContent = `${speed.toFixed(2)}x`;

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
    }

    setLoopEnd() {
        if (!this.player || !this.playerReady) return;

        this.loopEnd = this.player.getCurrentTime();
        this.elements.loopEndDisplay.textContent = this.formatTime(this.loopEnd);
        this.updateLoopUI();
        this.checkLoopButtonState();
    }

    toggleLoop() {
        if (this.loopStart === null || this.loopEnd === null) return;

        this.loopEnabled = !this.loopEnabled;

        if (this.loopEnabled) {
            this.elements.toggleLoopBtn.textContent = 'Disable Loop';
            this.elements.toggleLoopBtn.classList.add('active');
            this.startLoopCheck();
        } else {
            this.elements.toggleLoopBtn.textContent = 'Enable Loop';
            this.elements.toggleLoopBtn.classList.remove('active');
            this.stopLoopCheck();
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
            .map(video => `
                <div class="video-item ${this.currentVideoId === video.id ? 'active' : ''}" data-video-id="${video.id}">
                    <div class="video-item-header">
                        <h3>Video</h3>
                        <button class="btn btn-danger" onclick="app.removeVideo('${video.id}')" aria-label="Remove video">×</button>
                    </div>
                    <div class="video-id">${video.id}</div>
                </div>
            `)
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
