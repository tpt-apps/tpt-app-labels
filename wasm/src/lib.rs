//! WASM bindings for TPT Labels — a batch QR/DataMatrix/barcode label
//! generator built on the [`tpt-barcode`](https://github.com/tpt-solutions/tpt-barcode)
//! engine.
//!
//! Exposes one encode entry point per output format (`encode_svg` /
//! `encode_png`), dispatching on a `format` string so the JS side can drive
//! everything from a single `<select>` value: `"qr"`, `"datamatrix"`,
//! `"code128"`, `"code39"`, `"ean13"`, `"upca"`.

use tpt_barcode::core::EcLevel;
use tpt_barcode::prelude::*;
use wasm_bindgen::prelude::*;

fn js_err<E: core::fmt::Display>(err: E) -> JsValue {
    JsValue::from_str(&err.to_string())
}

fn parse_ec_level(level: &str) -> Result<EcLevel, JsValue> {
    match level.to_ascii_uppercase().as_str() {
        "L" => Ok(EcLevel::L),
        "M" => Ok(EcLevel::M),
        "Q" => Ok(EcLevel::Q),
        "H" => Ok(EcLevel::H),
        other => Err(JsValue::from_str(&format!(
            "invalid EC level '{other}': expected one of L, M, Q, H"
        ))),
    }
}

/// Digit-only payloads (EAN-13 / UPC-A) accept either the check digit or not;
/// this strips anything non-numeric so pasted/CSV data doesn't need to be
/// pre-cleaned by the caller.
fn digits_only(text: &str) -> Vec<u8> {
    text.bytes()
        .filter(|b| b.is_ascii_digit())
        .map(|b| b - b'0')
        .collect()
}

/// Encode `text` in `format` and render it to a self-contained SVG string.
///
/// `format` is one of `"qr"`, `"datamatrix"`, `"code128"`, `"code39"`,
/// `"ean13"`, `"upca"` (case-insensitive).
///
/// `ec_level` (`"L"`/`"M"`/`"Q"`/`"H"`) only applies to `"qr"`; it is ignored
/// for every other format. `module_size` is the pixel size of one module;
/// `height_px` is the bar height for 1D formats (ignored for 2D formats).
#[wasm_bindgen]
pub fn encode_svg(
    format: &str,
    text: &str,
    ec_level: &str,
    module_size: u32,
    height_px: u32,
) -> Result<String, JsValue> {
    match format.to_ascii_lowercase().as_str() {
        "qr" => {
            let ec = parse_ec_level(ec_level)?;
            let qr = tpt_barcode::qr::encode(text, ec).map_err(js_err)?;
            Ok(qr.to_svg_string(module_size))
        }
        "datamatrix" => {
            let dm = tpt_barcode::two_d::datamatrix::encode(text.as_bytes()).map_err(js_err)?;
            Ok(dm.to_svg_string(module_size))
        }
        "code128" => {
            let code = tpt_barcode::one_d::code128::encode_b(text.as_bytes()).map_err(js_err)?;
            Ok(tpt_barcode::render::svg::render_1d(
                &code.modules,
                module_size,
                height_px,
            ))
        }
        "code39" => {
            let code = tpt_barcode::one_d::code39::encode(text.as_bytes()).map_err(js_err)?;
            Ok(tpt_barcode::render::svg::render_1d(
                &code.modules,
                module_size,
                height_px,
            ))
        }
        "ean13" => {
            let code = tpt_barcode::one_d::ean13::encode(&digits_only(text)).map_err(js_err)?;
            Ok(tpt_barcode::render::svg::render_1d(
                &code.modules,
                module_size,
                height_px,
            ))
        }
        "upca" => {
            let code = tpt_barcode::one_d::upca::encode(&digits_only(text)).map_err(js_err)?;
            Ok(tpt_barcode::render::svg::render_1d(
                &code.modules,
                module_size,
                height_px,
            ))
        }
        other => Err(JsValue::from_str(&format!(
            "unknown format '{other}': expected one of qr, datamatrix, code128, code39, ean13, upca"
        ))),
    }
}

/// Encode `text` in `format` and render it to PNG bytes.
///
/// Same format/ec_level rules as [`encode_svg`]. `module_px` is the pixel
/// size of one module; `height_px` is the bar height for 1D formats
/// (ignored for 2D formats); `quiet_zone_px` is the blank padding in pixels.
#[wasm_bindgen]
pub fn encode_png(
    format: &str,
    text: &str,
    ec_level: &str,
    module_px: u32,
    height_px: u32,
    quiet_zone_px: u32,
) -> Result<Vec<u8>, JsValue> {
    match format.to_ascii_lowercase().as_str() {
        "qr" => {
            let ec = parse_ec_level(ec_level)?;
            let qr = tpt_barcode::qr::encode(text, ec).map_err(js_err)?;
            Ok(qr.to_png_bytes(module_px, quiet_zone_px))
        }
        "datamatrix" => {
            let dm = tpt_barcode::two_d::datamatrix::encode(text.as_bytes()).map_err(js_err)?;
            Ok(dm.to_png_bytes(module_px, quiet_zone_px))
        }
        "code128" => {
            let code = tpt_barcode::one_d::code128::encode_b(text.as_bytes()).map_err(js_err)?;
            Ok(tpt_barcode::render::png::render_1d_to_png(
                &code.modules,
                module_px,
                height_px,
                quiet_zone_px,
            ))
        }
        "code39" => {
            let code = tpt_barcode::one_d::code39::encode(text.as_bytes()).map_err(js_err)?;
            Ok(tpt_barcode::render::png::render_1d_to_png(
                &code.modules,
                module_px,
                height_px,
                quiet_zone_px,
            ))
        }
        "ean13" => {
            let code = tpt_barcode::one_d::ean13::encode(&digits_only(text)).map_err(js_err)?;
            Ok(tpt_barcode::render::png::render_1d_to_png(
                &code.modules,
                module_px,
                height_px,
                quiet_zone_px,
            ))
        }
        "upca" => {
            let code = tpt_barcode::one_d::upca::encode(&digits_only(text)).map_err(js_err)?;
            Ok(tpt_barcode::render::png::render_1d_to_png(
                &code.modules,
                module_px,
                height_px,
                quiet_zone_px,
            ))
        }
        other => Err(JsValue::from_str(&format!(
            "unknown format '{other}': expected one of qr, datamatrix, code128, code39, ean13, upca"
        ))),
    }
}

/// Called once by the JS glue on module init; wires up panic messages to the
/// browser console so failures are easier to diagnose than a bare "unreachable".
#[wasm_bindgen(start)]
pub fn init() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}
