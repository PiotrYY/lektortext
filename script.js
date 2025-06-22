// Zmienne globalne
let player;
let lektorAudio;
let audioFileInput;
let subtitlesFileInput;
let subtitlesContainer;
let subtitles = [];
let subtitlesInterval;

// Ta funkcja jest wywoływana automatycznie, gdy API YouTube jest gotowe.
function onYouTubeIframeAPIReady() {
    player = new YT.Player('youtube-player', {
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}

// Ta funkcja jest wywoływana, gdy odtwarzacz wideo jest gotowy.
function onPlayerReady(event) {
    // Inicjalizacja elementów DOM
    lektorAudio = document.getElementById('lektor-audio');
    audioFileInput = document.getElementById('audio-file-input');
    subtitlesFileInput = document.getElementById('subtitles-file-input');
    subtitlesContainer = document.getElementById('subtitles-container');

    // Nasłuchiwanie na zmianę pliku w inpucie audio
    audioFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const fileURL = URL.createObjectURL(file);
            lektorAudio.src = fileURL;
            player.mute();
            // Możesz dodać informację dla użytkownika, że lektor jest gotowy
            alert('Plik audio z lektorem został załadowany. Użyj kontrolek YouTube, aby odtwarzać.');
        }
    });

    // Nasłuchiwanie na zmianę pliku w inpucie napisów
    subtitlesFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                subtitles = parseVTT(evt.target.result);
                alert('Plik z napisami został załadowany.');
            };
            reader.readAsText(file);
        }
    });
}

// Ta funkcja jest wywoływana, gdy stan odtwarzacza się zmienia.
function onPlayerStateChange(event) {
    // Synchronizacja audio lektora z wideo
    switch (event.data) {
        case YT.PlayerState.PLAYING:
            lektorAudio.play();
            startSubtitles();
            break;
        case YT.PlayerState.PAUSED:
            lektorAudio.pause();
            stopSubtitles();
            break;
        case YT.PlayerState.ENDED:
            lektorAudio.currentTime = 0;
            lektorAudio.pause();
            stopSubtitles();
            break;
        case YT.PlayerState.BUFFERING:
            lektorAudio.pause();
            stopSubtitles();
            break;
        default:
            // Do nothing
    }
}

function parseVTT(data) {
    // Usuń nagłówek WEBVTT i znormalizuj końce linii
    const processedData = data.replace(/^WEBVTT\s*/, '').replace(/\r/g, '');
    // Podziel na pojedyncze bloki z napisami
    const cues = processedData.split(/\n\n+/);

    const subtitles = [];

    function timeToSeconds(timeStr) {
        if (!timeStr) return 0;
        const parts = timeStr.trim().split(':');
        let seconds = 0;
        if (parts.length === 3) {
            // Format HH:MM:SS.mmm
            seconds = parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2].replace(',', '.'));
        } else if (parts.length === 2) {
            // Format MM:SS.mmm
            seconds = parseFloat(parts[0]) * 60 + parseFloat(parts[1].replace(',', '.'));
        }
        return seconds;
    }

    for (const cue of cues) {
        const lines = cue.trim().split('\n');
        if (lines.length < 2) continue;

        // Pomijamy opcjonalny identyfikator napisu (np. "1")
        const timeLineIndex = lines[0].includes('-->') ? 0 : 1;
        if (!lines[timeLineIndex] || !lines[timeLineIndex].includes('-->')) continue;

        const timeParts = lines[timeLineIndex].split(' --> ');
        const textLines = lines.slice(timeLineIndex + 1).join('<br>');

        subtitles.push({
            time: {
                start: timeToSeconds(timeParts[0]),
                // Ignorujemy dodatkowe ustawienia w linii czasu, np. align:start
                end: timeToSeconds(timeParts[1].split(' ')[0])
            },
            text: textLines
        });
    }
    return subtitles;
}

function startSubtitles() {
    if (subtitles.length > 0) {
        subtitlesInterval = setInterval(() => {
            const currentTime = player.getCurrentTime();
            const currentSubtitle = subtitles.find(
                (sub) => currentTime >= sub.time.start && currentTime <= sub.time.end
            );

            if (currentSubtitle) {
                subtitlesContainer.innerHTML = currentSubtitle.text;
                subtitlesContainer.style.opacity = 1;
            } else {
                subtitlesContainer.style.opacity = 0;
            }
        }, 100); // Sprawdzanie co 100ms
    }
}

function stopSubtitles() {
    clearInterval(subtitlesInterval);
} 