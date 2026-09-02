use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{Deserialize, Serialize};
use sherpa_onnx::{GenerationConfig, OfflineTts, OfflineTtsConfig, OfflineTtsVitsModelConfig};
use std::{
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc::{self, Receiver, SyncSender, TrySendError},
        Arc,
    },
    thread,
    time::{Duration, Instant},
};
use tauri::State;

const MODEL_FILE: &str = "es_AR-daniela-high.onnx";
const TOKENS_FILE: &str = "tokens.txt";
const ESPEAK_DIRECTORY: &str = "espeak-ng-data";
const MAX_TEXT_CHARACTERS: usize = 780;
const MAX_QUEUE_DEPTH: usize = 2;
const RESPONSE_TIMEOUT: Duration = Duration::from_secs(60);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NarrationRequest {
    pub text: String,
    pub speed: Option<f32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NarrationResponse {
    pub audio_base64: String,
    pub sample_rate: i32,
    pub duration_ms: u64,
    pub generation_ms: u64,
    pub engine: &'static str,
    pub voice: &'static str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsStatus {
    pub available: bool,
    pub loaded: bool,
    pub engine: &'static str,
    pub voice: &'static str,
    pub locale: &'static str,
}

struct TtsJob {
    text: String,
    speed: f32,
    response: mpsc::Sender<Result<NarrationResponse, String>>,
}

pub struct TtsState {
    sender: SyncSender<TtsJob>,
    model_available: bool,
    loaded: Arc<AtomicBool>,
}

impl TtsState {
    pub fn new(model_directory: PathBuf) -> Self {
        let model_available = validate_model_directory(&model_directory).is_ok();
        let loaded = Arc::new(AtomicBool::new(false));
        let worker_loaded = Arc::clone(&loaded);
        let (sender, receiver) = mpsc::sync_channel(MAX_QUEUE_DEPTH);

        thread::Builder::new()
            .name("fortuna-tts".into())
            .spawn(move || worker_loop(receiver, model_directory, worker_loaded))
            .expect("no se pudo iniciar el trabajador de voz local");

        Self {
            sender,
            model_available,
            loaded,
        }
    }
}

fn worker_loop(receiver: Receiver<TtsJob>, model_directory: PathBuf, loaded: Arc<AtomicBool>) {
    let mut engine: Option<OfflineTts> = None;

    while let Ok(job) = receiver.recv() {
        let result = (|| {
            if engine.is_none() {
                engine = Some(create_engine(&model_directory)?);
                loaded.store(true, Ordering::Release);
            }

            synthesize(
                engine.as_ref().expect("el motor acaba de cargarse"),
                &job.text,
                job.speed,
            )
        })();

        let _ = job.response.send(result);
    }
}

fn validate_model_directory(model_directory: &Path) -> Result<(), String> {
    let required_paths = [
        model_directory.join(MODEL_FILE),
        model_directory.join(TOKENS_FILE),
        model_directory.join(ESPEAK_DIRECTORY),
    ];

    if required_paths.iter().all(|path| path.exists()) {
        Ok(())
    } else {
        Err("Los recursos de la voz neuronal no están completos.".into())
    }
}

fn create_engine(model_directory: &Path) -> Result<OfflineTts, String> {
    validate_model_directory(model_directory)?;

    let config = OfflineTtsConfig {
        model: sherpa_onnx::OfflineTtsModelConfig {
            vits: OfflineTtsVitsModelConfig {
                model: Some(
                    model_directory
                        .join(MODEL_FILE)
                        .to_string_lossy()
                        .into_owned(),
                ),
                tokens: Some(
                    model_directory
                        .join(TOKENS_FILE)
                        .to_string_lossy()
                        .into_owned(),
                ),
                data_dir: Some(
                    model_directory
                        .join(ESPEAK_DIRECTORY)
                        .to_string_lossy()
                        .into_owned(),
                ),
                noise_scale: 0.58,
                noise_scale_w: 0.68,
                length_scale: 1.0,
                ..Default::default()
            },
            num_threads: 2,
            debug: false,
            ..Default::default()
        },
        ..Default::default()
    };

    OfflineTts::create(&config).ok_or_else(|| "No se pudo cargar el motor de voz neuronal.".into())
}

fn synthesize(engine: &OfflineTts, text: &str, speed: f32) -> Result<NarrationResponse, String> {
    let started = Instant::now();
    let generation_config = GenerationConfig {
        sid: 0,
        speed: speed.clamp(0.82, 1.12),
        silence_scale: 0.22,
        ..Default::default()
    };
    let audio = engine
        .generate_with_config(text, &generation_config, None::<fn(&[f32], f32) -> bool>)
        .ok_or_else(|| "El motor local no pudo generar la locución.".to_string())?;
    let sample_rate = audio.sample_rate();
    let samples = audio.samples();

    if sample_rate <= 0 || samples.is_empty() {
        return Err("El motor local devolvió audio vacío.".into());
    }

    let styled_samples = apply_announcement_style(samples, sample_rate as u32);
    let wave = encode_pcm_wave(&styled_samples, sample_rate as u32)?;
    Ok(NarrationResponse {
        audio_base64: STANDARD.encode(wave),
        sample_rate,
        duration_ms: samples.len() as u64 * 1_000 / sample_rate as u64,
        generation_ms: started.elapsed().as_millis() as u64,
        engine: "sherpa-onnx",
        voice: "Daniela High · Anunciadora Fortuna",
    })
}

fn apply_announcement_style(samples: &[f32], sample_rate: u32) -> Vec<f32> {
    if samples.is_empty() || sample_rate == 0 {
        return Vec::new();
    }

    // Mantiene la voz clara y serena, con el carácter de un sistema de megafonía
    // elegante. El filtrado es deliberadamente sutil para conservar la dicción.
    let time_step = 1.0 / sample_rate as f32;
    let high_pass_rc = 1.0 / (2.0 * std::f32::consts::PI * 105.0);
    let high_pass_alpha = high_pass_rc / (high_pass_rc + time_step);
    let low_pass_rc = 1.0 / (2.0 * std::f32::consts::PI * 5_800.0);
    let low_pass_alpha = time_step / (low_pass_rc + time_step);
    let reflection_delay = (sample_rate as f32 * 0.024).round() as usize;
    let mut filtered = Vec::with_capacity(samples.len());
    let mut previous_input = 0.0_f32;
    let mut previous_high_pass = 0.0_f32;
    let mut previous_low_pass = 0.0_f32;

    for &sample in samples {
        let high_pass = high_pass_alpha * (previous_high_pass + sample - previous_input);
        previous_input = sample;
        previous_high_pass = high_pass;
        previous_low_pass += low_pass_alpha * (high_pass - previous_low_pass);
        filtered.push(previous_low_pass);
    }

    let mut styled = Vec::with_capacity(filtered.len());
    let mut peak = 0.0_f32;
    for (index, &sample) in filtered.iter().enumerate() {
        let reflection = index
            .checked_sub(reflection_delay)
            .map_or(0.0, |delayed| filtered[delayed] * 0.035);
        let compressed = ((sample + reflection) * 1.18).tanh();
        peak = peak.max(compressed.abs());
        styled.push(compressed);
    }

    let gain = if peak > 0.001 { 0.82 / peak } else { 1.0 };
    for sample in &mut styled {
        *sample = (*sample * gain).clamp(-1.0, 1.0);
    }
    styled
}

fn encode_pcm_wave(samples: &[f32], sample_rate: u32) -> Result<Vec<u8>, String> {
    let data_length = samples
        .len()
        .checked_mul(2)
        .and_then(|length| u32::try_from(length).ok())
        .ok_or_else(|| "La locución generada es demasiado extensa.".to_string())?;
    let riff_length = 36_u32
        .checked_add(data_length)
        .ok_or_else(|| "La locución generada es demasiado extensa.".to_string())?;
    let mut wave = Vec::with_capacity(data_length as usize + 44);

    wave.extend_from_slice(b"RIFF");
    wave.extend_from_slice(&riff_length.to_le_bytes());
    wave.extend_from_slice(b"WAVEfmt ");
    wave.extend_from_slice(&16_u32.to_le_bytes());
    wave.extend_from_slice(&1_u16.to_le_bytes());
    wave.extend_from_slice(&1_u16.to_le_bytes());
    wave.extend_from_slice(&sample_rate.to_le_bytes());
    wave.extend_from_slice(&(sample_rate * 2).to_le_bytes());
    wave.extend_from_slice(&2_u16.to_le_bytes());
    wave.extend_from_slice(&16_u16.to_le_bytes());
    wave.extend_from_slice(b"data");
    wave.extend_from_slice(&data_length.to_le_bytes());

    for sample in samples {
        let pcm = (sample.clamp(-1.0, 1.0) * i16::MAX as f32).round() as i16;
        wave.extend_from_slice(&pcm.to_le_bytes());
    }

    Ok(wave)
}

fn normalize_request(request: NarrationRequest) -> Result<(String, f32), String> {
    let normalized = request
        .text
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    if normalized.is_empty() {
        return Err("No hay texto para narrar.".into());
    }

    let text = normalized
        .chars()
        .take(MAX_TEXT_CHARACTERS)
        .collect::<String>();
    Ok((text, request.speed.unwrap_or(1.0).clamp(0.82, 1.12)))
}

#[tauri::command]
pub fn offline_tts_status(state: State<'_, TtsState>) -> TtsStatus {
    TtsStatus {
        available: state.model_available,
        loaded: state.loaded.load(Ordering::Acquire),
        engine: "sherpa-onnx",
        voice: "Daniela High · Anunciadora Fortuna",
        locale: "es-AR",
    }
}

#[tauri::command]
pub async fn synthesize_offline_speech(
    request: NarrationRequest,
    state: State<'_, TtsState>,
) -> Result<NarrationResponse, String> {
    if !state.model_available {
        return Err("La voz neuronal local no está instalada.".into());
    }

    let (text, speed) = normalize_request(request)?;
    let sender = state.sender.clone();

    tauri::async_runtime::spawn_blocking(move || {
        let (response_sender, response_receiver) = mpsc::channel();
        let job = TtsJob {
            text,
            speed,
            response: response_sender,
        };

        match sender.try_send(job) {
            Ok(()) => response_receiver
                .recv_timeout(RESPONSE_TIMEOUT)
                .map_err(|_| "La voz local tardó demasiado en responder.".to_string())?,
            Err(TrySendError::Full(_)) => Err("La voz local está procesando otra locución.".into()),
            Err(TrySendError::Disconnected(_)) => {
                Err("El motor de voz local no está disponible.".into())
            }
        }
    })
    .await
    .map_err(|error| format!("No se pudo completar la locución local: {error}"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_and_limits_requests() {
        let (text, speed) = normalize_request(NarrationRequest {
            text: format!("  Hola   Fortuna  {}", "x".repeat(900)),
            speed: Some(8.0),
        })
        .expect("request válido");

        assert!(text.starts_with("Hola Fortuna"));
        assert_eq!(text.chars().count(), MAX_TEXT_CHARACTERS);
        assert_eq!(speed, 1.12);
    }

    #[test]
    fn writes_a_valid_mono_pcm_wave() {
        let wave = encode_pcm_wave(&[0.0, 0.5, -0.5], 22_050).expect("wav válido");
        assert_eq!(&wave[0..4], b"RIFF");
        assert_eq!(&wave[8..12], b"WAVE");
        assert_eq!(&wave[36..40], b"data");
        assert_eq!(wave.len(), 50);
    }

    #[test]
    fn announcement_style_is_bounded_and_keeps_the_signal() {
        let styled = apply_announcement_style(&[0.0, 0.25, -0.5, 0.4, -0.1], 22_050);
        assert_eq!(styled.len(), 5);
        assert!(styled
            .iter()
            .all(|sample| sample.is_finite() && sample.abs() <= 1.0));
        assert!(styled.iter().any(|sample| sample.abs() > 0.01));
    }

    #[test]
    #[ignore = "genera una muestra real de la voz neuronal"]
    fn generates_real_spanish_sample() {
        let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let model_directory = manifest
            .join("resources")
            .join("tts")
            .join("vits-piper-es_AR-daniela-high");
        let engine = create_engine(&model_directory).expect("modelo local cargado");
        let result = synthesize(
            &engine,
            "Atención, participantes. La siguiente ronda está a punto de comenzar. Permanezcan atentos. El resultado será anunciado en unos instantes.",
            0.9,
        )
        .expect("audio generado");
        let wave = STANDARD.decode(result.audio_base64).expect("base64 válido");
        let output = manifest.join("target").join("fortuna-real-voz-natural.wav");
        std::fs::write(&output, wave).expect("muestra escrita");

        assert_eq!(result.sample_rate, 22_050);
        assert!(result.duration_ms > 1_500);
        println!(
            "{} ms de audio generados en {} ms: {}",
            result.duration_ms,
            result.generation_ms,
            output.display()
        );
    }
}
