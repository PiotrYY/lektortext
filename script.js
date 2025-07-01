/**
 * Zarządza pojedynczą instancją komponentu odtwarzacza wideo.
 */
class LektorPlayer {
    constructor(element) {
        this.element = element;
        this.player = null;
        this.lektorAudio = null;
        this.subtitlesContainer = null;
        this.subtitles = [];
        this.subtitlesInterval = null;

        // Odczytaj konfigurację z atrybutów data-*
        this.videoUrl = this.element.dataset.videoUrl;
        this.videoId = this.extractVideoId(this.videoUrl);
        this.audioSrc = this.element.dataset.audioSrc;
        this.subtitlesSrc = this.element.dataset.subtitlesSrc;

        // Znajdź kluczowe elementy wewnątrz komponentu
        this.playerContainer = this.element.querySelector('.youtube-player-container');
        this.lektorAudio = this.element.querySelector('.lektor-audio');
        this.subtitlesContainer = this.element.querySelector('.subtitles-container');
    }

    /**
     * Wyodrębnia ID filmu YouTube z różnych formatów URL.
     * @param {string} url - Adres URL filmu.
     * @returns {string|null} - ID filmu lub null, jeśli nie znaleziono.
     */
    extractVideoId(url) {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);

        if (match && match[2].length === 11) {
            return match[2];
        } else {
            console.error('Nie udało się wyodrębnić ID filmu z URL:', url);
            return null;
        }
    }

    /**
     * Inicjalizuje odtwarzacz YouTube dla tej instancji.
     */
    initPlayer() {
        const uniqueId = 'player-' + Math.random().toString(36).substring(2, 9);
        this.playerContainer.id = uniqueId;

        // Ustaw unikalne nazwy dla radio buttonów, aby nie kolidowały z innymi instancjami
        this.element.querySelectorAll('input[name="audio-mode"]').forEach(radio => {
            radio.name = `audio-mode-${uniqueId}`;
        });

        this.player = new YT.Player(uniqueId, {
            videoId: this.videoId,
            playerVars: { 
                'playsinline': 1,
                'rel': 0 
            },
            events: {
                'onReady': (event) => this.onPlayerReady(event),
                'onStateChange': (event) => this.onPlayerStateChange(event)
            }
        });
    }

    /**
     * Wywoływana, gdy odtwarzacz jest gotowy.
     */
    onPlayerReady() {
        this.loadResources();
        this.setupControls();
        
        // Odczytaj domyślny tryb z atrybutu 'checked' w HTML,
        // ponieważ właściwość DOM ':checked' może być nieprawidłowa z powodu kolizji nazw.
        const defaultRadio = this.element.querySelector('input[name^="audio-mode-"][checked]');
        
        let defaultMode = 'original';
        if (defaultRadio) {
            defaultMode = defaultRadio.value;
            // Upewnijmy się, że po zmianie nazw przycisk jest poprawnie zaznaczony wizualnie.
            defaultRadio.checked = true;
        } else {
            // Jeśli żaden przycisk nie miał atrybutu 'checked', zaznacz 'Oryginał'.
            const originalRadio = this.element.querySelector('input[value="original"]');
            if(originalRadio) originalRadio.checked = true;
        }

        this.setAudioMode(defaultMode);
    }

    /**
     * Ładuje zewnętrzne zasoby (audio i napisy).
     */
    loadResources() {
        if (this.audioSrc) {
            this.lektorAudio.src = this.audioSrc;
        }
        if (this.subtitlesSrc) {
            fetch(this.subtitlesSrc)
                .then(response => response.ok ? response.text() : Promise.reject('Błąd sieci'))
                .then(data => {
                    this.subtitles = this.parseVTT(data);
                })
                .catch(error => console.error('Błąd wczytywania napisów:', error));
        }
    }

    /**
     * Ustawia listenery dla kontrolek tej instancji.
     */
    setupControls() {
        this.element.querySelectorAll(`input[name^="audio-mode-"]`).forEach(radio => {
            radio.addEventListener('change', (e) => this.setAudioMode(e.target.value));
        });
        this.element.querySelector('.subtitles-toggle').addEventListener('change', (e) => {
            this.toggleSubtitles(e.target.checked);
        });
    }

    /**
     * Wywoływana przy zmianie stanu odtwarzacza (odtwarzanie, pauza, etc.).
     */
    onPlayerStateChange(event) {
        const isLectorActive = this.element.querySelector('input[value="lector"]').checked;
        if (!isLectorActive || !this.lektorAudio) return;

        switch (event.data) {
            case YT.PlayerState.PLAYING:
                this.lektorAudio.currentTime = this.player.getCurrentTime();
                this.lektorAudio.play();
                break;
            case YT.PlayerState.PAUSED:
                this.lektorAudio.pause();
                break;
            case YT.PlayerState.ENDED:
                this.lektorAudio.currentTime = 0;
                this.lektorAudio.pause();
                break;
            case YT.PlayerState.BUFFERING: this.lektorAudio.pause(); break;
        }
    }
    
    setAudioMode(mode) {
        if (mode === 'lector') {
            this.player.setVolume(20);
            if (this.player.getPlayerState() === YT.PlayerState.PLAYING) {
                this.lektorAudio.currentTime = this.player.getCurrentTime();
                this.lektorAudio.play();
            }
        } else {
            this.player.setVolume(100);
            this.lektorAudio.pause();
        }
    }

    toggleSubtitles(show) {
        if (show) {
            this.startSubtitles();
        } else {
            this.stopSubtitles();
            if (this.subtitlesContainer) {
                this.subtitlesContainer.style.opacity = 0;
            }
        }
    }

    startSubtitles() {
        if (this.subtitles.length > 0) {
            this.subtitlesInterval = setInterval(() => {
                const currentTime = this.player.getCurrentTime();
                const currentSubtitle = this.subtitles.find(
                    (sub) => currentTime >= sub.time.start && currentTime <= sub.time.end
                );
                if (currentSubtitle) {
                    this.subtitlesContainer.innerHTML = currentSubtitle.text;
                    this.subtitlesContainer.style.opacity = 1;
                } else {
                    this.subtitlesContainer.style.opacity = 0;
                }
            }, 100);
        }
    }

    stopSubtitles() {
        clearInterval(this.subtitlesInterval);
    }

    parseVTT(data) {
        const processedData = data.replace(/^WEBVTT\s*/, '').replace(/\r/g, '');
        const cues = processedData.split(/\n\n+/);
        const subtitles = [];
        const timeToSeconds = (timeStr) => {
            if (!timeStr) return 0;
            const parts = timeStr.trim().split(':');
            let seconds = 0;
            if (parts.length === 3) {
                seconds = parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2].replace(',', '.'));
            } else if (parts.length === 2) {
                seconds = parseFloat(parts[0]) * 60 + parseFloat(parts[1].replace(',', '.'));
            }
            return seconds;
        };
        for (const cue of cues) {
            const lines = cue.trim().split('\n');
            if (lines.length < 2) continue;
            const timeLineIndex = lines[0].includes('-->') ? 0 : 1;
            if (!lines[timeLineIndex] || !lines[timeLineIndex].includes('-->')) continue;
            const timeParts = lines[timeLineIndex].split(' --> ');
            const textLines = lines.slice(timeLineIndex + 1).join('<br>');
            subtitles.push({
                time: {
                    start: timeToSeconds(timeParts[0]),
                    end: timeToSeconds(timeParts[1].split(' ')[0])
                },
                text: textLines
            });
        }
        return subtitles;
    }
}

/**
 * Globalna funkcja wywoływana przez API YouTube, gdy jest gotowe.
 * Znajduje wszystkie komponenty na stronie i tworzy dla nich instancje LektorPlayer.
 */
function onYouTubeIframeAPIReady() {
    document.querySelectorAll('.video-player-component').forEach(element => {
        const playerInstance = new LektorPlayer(element);
        playerInstance.initPlayer();
    });
} 