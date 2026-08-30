//! Release gate: verify the exact distributed installer with the app's public key.
use base64::{engine::general_purpose::STANDARD, Engine};
use minisign_verify::{PublicKey, Signature};
use serde_json::Value;
use std::{error::Error, fs, io::Read, path::Path};

fn main() -> Result<(), Box<dyn Error>> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 4 {
        return Err(
            "Uso: verify_installer <instalador.exe> <instalador.exe.sig> <latest.json>".into(),
        );
    }
    let installer_path = Path::new(&args[1]);
    let signature_base64 = fs::read_to_string(&args[2])?;
    let manifest_text = fs::read_to_string(&args[3])?;
    let manifest: Value = serde_json::from_str(manifest_text.trim_start_matches('\u{feff}'))?;
    let config: Value = serde_json::from_str(include_str!("../tauri.conf.json"))?;
    let version = env!("CARGO_PKG_VERSION");
    if manifest["version"].as_str() != Some(version) || config["version"].as_str() != Some(version)
    {
        return Err("La versión del manifiesto, la aplicación y el instalador no coincide.".into());
    }
    let platform = &manifest["platforms"]["windows-x86_64"];
    if platform["signature"].as_str() != Some(signature_base64.trim()) {
        return Err("latest.json no contiene la firma del instalador distribuido.".into());
    }
    let filename = installer_path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or("Nombre de instalador inválido.")?;
    let expected_url = format!(
        "https://github.com/OscarD0823/Fortuna-Real/releases/download/v{version}/{filename}"
    );
    if platform["url"].as_str() != Some(&expected_url) {
        return Err("latest.json no apunta al instalador y la etiqueta correctos.".into());
    }

    let public_key_text = String::from_utf8(
        STANDARD.decode(
            config["plugins"]["updater"]["pubkey"]
                .as_str()
                .ok_or("Falta la clave pública del actualizador.")?,
        )?,
    )?;
    let signature_text = String::from_utf8(STANDARD.decode(signature_base64.trim())?)?;
    let public_key = PublicKey::decode(&public_key_text)?;
    let signature = Signature::decode(&signature_text)?;
    let mut verifier = public_key.verify_stream(&signature)?;
    let mut file = fs::File::open(installer_path)?;
    let mut buffer = [0u8; 65_536];
    loop {
        let count = file.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        verifier.update(&buffer[..count]);
    }
    verifier.finalize()?;
    println!("Firma criptográfica y manifiesto verificados: Fortuna Real {version}.");
    Ok(())
}
