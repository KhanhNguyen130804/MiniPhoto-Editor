import { filters, type T2DPipelineState, type TWebGLUniformLocationMap } from 'fabric';
import { applyColorTransferPixels, normalizeColorTransfer, validateColorTransfer } from './colorTransfer';
import type { ColorTransferSettings } from './snapshot';

const fragmentSource = `
precision highp float;
uniform sampler2D uTexture;
uniform vec3 uGain;
uniform vec3 uOffset;
uniform float uStrength;
varying vec2 vTexCoord;
float linearChannel(float c) { return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4); }
float encodeChannel(float c) { c = clamp(c, 0.0, 1.0); return c <= 0.0031308 ? c * 12.92 : 1.055 * pow(c, 1.0 / 2.4) - 0.055; }
float labCurve(float v) { return v > 216.0 / 24389.0 ? pow(v, 1.0 / 3.0) : (24389.0 / 27.0 * v + 16.0) / 116.0; }
float inverseCurve(float v) { return v > 6.0 / 29.0 ? v * v * v : (116.0 * v - 16.0) / (24389.0 / 27.0); }
void main() {
  vec4 color = texture2D(uTexture, vTexCoord);
  if (color.a == 0.0) { gl_FragColor = color; return; }
  vec3 rgb = vec3(linearChannel(color.r), linearChannel(color.g), linearChannel(color.b));
  vec3 xyz = vec3(
    dot(rgb, vec3(0.4124564, 0.3575761, 0.1804375)) / 0.95047,
    dot(rgb, vec3(0.2126729, 0.7151522, 0.0721750)),
    dot(rgb, vec3(0.0193339, 0.1191920, 0.9503041)) / 1.08883);
  vec3 f = vec3(labCurve(xyz.x), labCurve(xyz.y), labCurve(xyz.z));
  vec3 lab = vec3(116.0 * f.y - 16.0, 500.0 * (f.x - f.y), 200.0 * (f.y - f.z));
  lab = mix(lab, lab * uGain + uOffset, uStrength);
  float fy = (clamp(lab.x, 0.0, 100.0) + 16.0) / 116.0;
  xyz = vec3(0.95047 * inverseCurve(fy + lab.y / 500.0), inverseCurve(fy), 1.08883 * inverseCurve(fy - lab.z / 200.0));
  rgb = vec3(dot(xyz, vec3(3.2404542, -1.5371385, -0.4985314)),
    dot(xyz, vec3(-0.9692660, 1.8760108, 0.0415560)), dot(xyz, vec3(0.0556434, -0.2040259, 1.0572252)));
  gl_FragColor = vec4(encodeChannel(rgb.r), encodeChannel(rgb.g), encodeChannel(rgb.b), color.a);
}`;

export class ColorTransferFilter extends filters.BaseFilter<'ColorTransfer', { settings: ColorTransferSettings }> {
  static type = 'ColorTransfer';
  static uniformLocations = ['uGain', 'uOffset', 'uStrength'];
  declare settings: ColorTransferSettings;

  constructor(settings: ColorTransferSettings) {
    validateColorTransfer(settings, true);
    super({ settings });
  }

  getFragmentSource(): string { return fragmentSource; }
  isNeutralState(): boolean { return normalizeColorTransfer(this.settings) === null; }
  applyTo2d({ imageData }: T2DPipelineState): void { applyColorTransferPixels(imageData, this.settings); }
  sendUniformData(gl: WebGLRenderingContext, locations: TWebGLUniformLocationMap): void {
    gl.uniform3fv(locations.uGain, this.settings.gain);
    gl.uniform3fv(locations.uOffset, this.settings.offset);
    gl.uniform1f(locations.uStrength, this.settings.strength / 100);
  }
}
