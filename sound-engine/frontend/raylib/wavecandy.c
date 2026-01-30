#include "raylib.h"
#include <math.h>
#include <stdio.h>
#include <string.h>

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#else
#define EMSCRIPTEN_KEEPALIVE
#endif

#define WC_FREQ_BINS 512
#define WC_WAVE_SAMPLES 1024
#define WC_STEREO_SAMPLES 1024

typedef struct Layout {
  Rectangle tiles[5];
  Rectangle content[5];
  int count;
} Layout;

static float g_wave[WC_WAVE_SAMPLES] = {0};
static float g_left[WC_STEREO_SAMPLES] = {0};
static float g_right[WC_STEREO_SAMPLES] = {0};
static float g_freq[WC_FREQ_BINS] = {0};

static int g_screen_w = 1200;
static int g_screen_h = 210;

static Image g_spectro_image = {0};
static Texture2D g_spectro_tex = {0};
static int g_spectro_w = 0;
static int g_spectro_h = 0;

static RenderTexture2D g_scope_rt = {0};
static int g_scope_w = 0;
static int g_scope_h = 0;

static RenderTexture2D g_vector_rt = {0};
static int g_vector_w = 0;
static int g_vector_h = 0;

static int g_show_vector = 0;

static const float kWeightsFull[5] = {1.1f, 1.55f, 0.55f, 0.55f, 1.1f};
static const float kWeightsCompact[4] = {1.2f, 1.7f, 0.55f, 1.1f};

static const char *kLabelsFull[5] = {
  "Spectrogram",
  "Oscilloscope",
  "Level",
  "Stereo Field",
  "Spectrum"
};

static const char *kLabelsCompact[4] = {
  "Spectrogram",
  "Oscilloscope",
  "Level",
  "Spectrum"
};

static Layout ComputeLayout(int width, int height, const float *weights, int count) {
  Layout layout = {0};
  layout.count = count;
  float pad = 10.0f;
  float gap = 8.0f;
  float label_h = 12.0f;
  float label_gap = 6.0f;
  float inner_pad = 8.0f;

  float available_w = (float)width - pad * 2.0f - gap * 4.0f;
  if (available_w < 0.0f) available_w = (float)width;

  float sum = 0.0f;
  for (int i = 0; i < count; i++) {
    sum += weights[i];
  }

  float x = pad;
  float tile_h = (float)height - pad * 2.0f;
  for (int i = 0; i < count; i++) {
    float w = (available_w * weights[i]) / sum;
    layout.tiles[i] = (Rectangle){x, pad, w, tile_h};

    float content_y = pad + label_h + label_gap;
    float content_h = tile_h - (label_h + label_gap + inner_pad);
    float content_w = w - inner_pad * 2.0f;
    if (content_w < 1.0f) content_w = 1.0f;
    if (content_h < 1.0f) content_h = 1.0f;

    layout.content[i] = (Rectangle){
      x + inner_pad,
      content_y,
      content_w,
      content_h
    };

    x += w + gap;
  }

  return layout;
}

static void EnsureSpectrogram(int width, int height) {
  if (width <= 1 || height <= 1) return;
  if (width == g_spectro_w && height == g_spectro_h) return;

  if (g_spectro_tex.id > 0) {
    UnloadTexture(g_spectro_tex);
  }
  if (g_spectro_image.data) {
    UnloadImage(g_spectro_image);
  }

  g_spectro_image = GenImageColor(width, height, (Color){4, 8, 12, 255});
  g_spectro_tex = LoadTextureFromImage(g_spectro_image);
  g_spectro_w = width;
  g_spectro_h = height;
}

static void UpdateSpectrogramColumn(void) {
  if (!g_spectro_image.data || g_spectro_w <= 1 || g_spectro_h <= 1) return;
  Color *pixels = (Color *)g_spectro_image.data;

  for (int y = 0; y < g_spectro_h; y++) {
    Color *row = pixels + y * g_spectro_w;
    memmove(row, row + 1, sizeof(Color) * (g_spectro_w - 1));

    float ratio = 1.0f - ((float)y / (float)(g_spectro_h - 1));
    float curved = ratio * ratio;
    int idx = (int)(curved * (WC_FREQ_BINS - 1));
    if (idx < 0) idx = 0;
    if (idx >= WC_FREQ_BINS) idx = WC_FREQ_BINS - 1;

    float value = g_freq[idx];
    float hue = 260.0f - value * 220.0f;
    float light = 0.18f + value * 0.62f;
    Color color = ColorFromHSV(hue, 0.88f, light);
    row[g_spectro_w - 1] = color;
  }

  UpdateTexture(g_spectro_tex, g_spectro_image.data);
}

static void EnsureScopeTexture(int width, int height) {
  if (width <= 1 || height <= 1) return;
  if (width == g_scope_w && height == g_scope_h && g_scope_rt.id > 0) return;

  if (g_scope_rt.id > 0) {
    UnloadRenderTexture(g_scope_rt);
  }

  g_scope_rt = LoadRenderTexture(width, height);
  g_scope_w = width;
  g_scope_h = height;

  BeginTextureMode(g_scope_rt);
  ClearBackground((Color){6, 9, 14, 255});
  EndTextureMode();
}

static void EnsureVectorTexture(int width, int height) {
  if (width <= 1 || height <= 1) return;
  if (width == g_vector_w && height == g_vector_h && g_vector_rt.id > 0) return;

  if (g_vector_rt.id > 0) {
    UnloadRenderTexture(g_vector_rt);
  }

  g_vector_rt = LoadRenderTexture(width, height);
  g_vector_w = width;
  g_vector_h = height;

  BeginTextureMode(g_vector_rt);
  ClearBackground((Color){6, 9, 14, 255});
  EndTextureMode();
}

static void DrawTileShell(Rectangle tile, Rectangle content, const char *label) {
  Color tile_bg = (Color){7, 11, 18, 220};
  Color tile_border = (Color){32, 42, 56, 200};
  Color content_bg = (Color){6, 9, 14, 230};
  Color label_color = (Color){190, 198, 208, 200};

  DrawRectangleRounded(tile, 0.12f, 8, tile_bg);
  DrawRectangleRoundedLinesEx(tile, 0.12f, 8, 1.0f, tile_border);
  DrawText(label, (int)(tile.x + 10.0f), (int)(tile.y + 6.0f), 10, label_color);
  DrawRectangleRounded(content, 0.08f, 6, content_bg);
}

static float SampleAt(const float *buffer, int len, float index) {
  if (len <= 0) return 0.0f;
  float wrapped = fmodf(index, (float)len);
  if (wrapped < 0.0f) wrapped += (float)len;
  int i0 = (int)wrapped;
  int i1 = (i0 + 1) % len;
  float t = wrapped - (float)i0;
  return buffer[i0] + (buffer[i1] - buffer[i0]) * t;
}

static int FindTriggerIndex(const float *buffer, int len) {
  float threshold = 0.02f;
  for (int i = 1; i < len; i++) {
    float prev = buffer[i - 1];
    float curr = buffer[i];
    if (prev < -threshold && curr >= threshold) return i;
  }
  return 0;
}

static void DrawWaveform(Rectangle rect) {
  int width = (int)rect.width;
  int height = (int)rect.height;
  if (width < 2 || height < 2) return;

  EnsureScopeTexture(width, height);
  if (g_scope_rt.id == 0) return;

  BeginTextureMode(g_scope_rt);
  DrawRectangle(0, 0, width, height, (Color){6, 9, 14, 30});

  float mid = height * 0.5f;
  Color grid = (Color){120, 170, 220, 18};
  for (int i = 1; i < 4; i++) {
    float x = (width / 4.0f) * i;
    DrawLineV((Vector2){x, 0}, (Vector2){x, height}, grid);
  }
  DrawLineV((Vector2){0, mid}, (Vector2){width, mid}, (Color){255, 255, 255, 24});

  int trigger = FindTriggerIndex(g_wave, WC_WAVE_SAMPLES);
  float span = (float)(WC_WAVE_SAMPLES - 1);
  float step = span / (float)(width - 1);

  Color glow_outer = (Color){246, 160, 80, 40};
  Color glow_inner = (Color){246, 180, 110, 90};
  Color main = (Color){246, 196, 132, 220};
  Color cool = (Color){120, 210, 255, 120};

  Vector2 prev_main = {0};
  Vector2 prev_left = {0};
  Vector2 prev_right = {0};
  for (int x = 0; x < width; x++) {
    float idx = (float)trigger + step * (float)x;
    float raw = SampleAt(g_wave, WC_WAVE_SAMPLES, idx);
    float smooth = (SampleAt(g_wave, WC_WAVE_SAMPLES, idx - 1.0f) +
                    raw +
                    SampleAt(g_wave, WC_WAVE_SAMPLES, idx + 1.0f)) / 3.0f;

    float left = SampleAt(g_left, WC_STEREO_SAMPLES, idx);
    float right = SampleAt(g_right, WC_STEREO_SAMPLES, idx);
    float y = mid - smooth * height * 0.42f;
    Vector2 point = {(float)x, y};

    float y_left = mid - left * height * 0.38f;
    float y_right = mid - right * height * 0.38f;
    Vector2 p_left = {(float)x, y_left};
    Vector2 p_right = {(float)x, y_right};

    if (x > 0) {
      DrawLineEx(prev_main, point, 4.5f, glow_outer);
      DrawLineEx(prev_main, point, 2.6f, glow_inner);
      DrawLineEx(prev_main, point, 1.2f, main);

      DrawLineEx(prev_left, p_left, 1.0f, cool);
      DrawLineEx(prev_right, p_right, 1.0f, cool);
    }

    prev_main = point;
    prev_left = p_left;
    prev_right = p_right;
  }

  EndTextureMode();

  DrawTexturePro(
    g_scope_rt.texture,
    (Rectangle){0, 0, (float)width, (float)-height},
    rect,
    (Vector2){0, 0},
    0.0f,
    WHITE
  );
}

static void DrawSpectrum(Rectangle rect) {
  int width = (int)rect.width;
  int height = (int)rect.height;
  if (width < 2 || height < 2) return;

  Color grid = (Color){90, 140, 190, 18};
  for (int i = 1; i < 4; i++) {
    float y = rect.y + (rect.height / 4.0f) * i;
    DrawLineV((Vector2){rect.x, y}, (Vector2){rect.x + rect.width, y}, grid);
  }

  float logMax = logf((float)(WC_FREQ_BINS));
  float yBase = rect.y + rect.height;

  BeginBlendMode(BLEND_ADDITIVE);
  Vector2 prevGlow = {0};
  Vector2 prevMain = {0};
  for (int x = 0; x < width; x++) {
    float t = (float)x / (float)(width - 1);
    float idxf = expf(t * logMax) - 1.0f;
    int idx = (int)idxf;
    if (idx < 0) idx = 0;
    if (idx >= WC_FREQ_BINS) idx = WC_FREQ_BINS - 1;

    float a = g_freq[idx];
    float b = g_freq[idx < WC_FREQ_BINS - 1 ? idx + 1 : idx];
    float frac = idxf - (float)idx;
    float v = a + (b - a) * frac;
    v = powf(v, 0.6f);

    float y = yBase - v * rect.height * 0.92f;
    Vector2 point = {(float)x + rect.x, y};

    float alphaFill = 40.0f + 160.0f * v;
    DrawLineV((Vector2){rect.x + x, y}, (Vector2){rect.x + x, yBase}, (Color){70, 170, 255, (unsigned char)alphaFill});

    if (x > 0) {
      DrawLineEx(prevGlow, point, 3.8f, (Color){90, 190, 255, 50});
      DrawLineEx(prevMain, point, 1.4f, (Color){150, 220, 255, 210});
    }
    prevGlow = point;
    prevMain = point;
  }
  EndBlendMode();

}

static void DrawGoniometer(Rectangle rect) {
  int width = (int)rect.width;
  int height = (int)rect.height;
  if (width < 2 || height < 2) return;

  EnsureVectorTexture(width, height);
  if (g_vector_rt.id == 0) return;

  BeginTextureMode(g_vector_rt);
  DrawRectangle(0, 0, width, height, (Color){6, 9, 14, 28});

  Color grid = (Color){110, 160, 210, 20};
  float mid_x = width * 0.5f;
  DrawLineV((Vector2){mid_x, 0}, (Vector2){mid_x, height}, grid);
  DrawLineV((Vector2){0, height - 10}, (Vector2){width, height - 10}, (Color){110, 160, 210, 14});

  BeginBlendMode(BLEND_ADDITIVE);
  for (int i = 0; i < WC_STEREO_SAMPLES; i += 2) {
    float l = g_left[i];
    float r = g_right[i];
    float mid = (l + r) * 0.5f;
    float side = (l - r) * 0.5f;

    float pan = side * 1.6f;
    if (pan < -1.0f) pan = -1.0f;
    if (pan > 1.0f) pan = 1.0f;

    float amp = fabsf(mid) * 0.85f + fabsf(side) * 0.35f;
    float y = height - 12.0f - powf(amp, 0.7f) * (height - 16.0f);
    float x = (pan * 0.5f + 0.5f) * (float)width;

    float energy = 0.4f + 0.6f * amp;
    Color halo = (Color){90, 190, 255, (unsigned char)(30 + 80 * energy)};
    Color core = (Color){246, 186, 120, (unsigned char)(60 + 120 * energy)};
    DrawCircleV((Vector2){x, y}, 1.9f, halo);
    DrawCircleV((Vector2){x, y}, 1.1f, core);
  }
  EndBlendMode();

  float sum_lr = 0.0f;
  float sum_l2 = 0.0f;
  float sum_r2 = 0.0f;
  for (int i = 0; i < WC_STEREO_SAMPLES; i++) {
    float l = g_left[i];
    float r = g_right[i];
    sum_lr += l * r;
    sum_l2 += l * l;
    sum_r2 += r * r;
  }
  float denom = sqrtf(sum_l2 * sum_r2) + 1e-6f;
  float corr = sum_lr / denom;
  if (corr < -1.0f) corr = -1.0f;
  if (corr > 1.0f) corr = 1.0f;

  float bar_y = height - 8.0f;
  DrawLineV((Vector2){10, bar_y}, (Vector2){width - 10, bar_y}, (Color){90, 130, 170, 80});
  float marker_x = 10.0f + (corr + 1.0f) * 0.5f * (width - 20.0f);
  DrawLineEx((Vector2){marker_x, bar_y - 4.0f}, (Vector2){marker_x, bar_y + 4.0f}, 2.0f, (Color){246, 186, 120, 200});

  EndTextureMode();

  DrawTexturePro(
    g_vector_rt.texture,
    (Rectangle){0, 0, (float)width, (float)-height},
    rect,
    (Vector2){0, 0},
    0.0f,
    WHITE
  );
}

static void DrawMeter(Rectangle rect) {
  float sum = 0.0f;
  float peak = 0.0f;
  int len = WC_STEREO_SAMPLES;
  for (int i = 0; i < len; i += 2) {
    float sample = (g_left[i] + g_right[i]) * 0.5f;
    float abs = fabsf(sample);
    sum += sample * sample;
    if (abs > peak) peak = abs;
  }
  float rms = sqrtf(sum / (float)len);
  float rms_db = 20.0f * log10f(rms + 1e-6f);
  float peak_db = 20.0f * log10f(peak + 1e-6f);

  float rms_height = (rms_db + 60.0f) / 60.0f;
  float peak_height = (peak_db + 60.0f) / 60.0f;
  if (rms_height < 0.0f) rms_height = 0.0f;
  if (rms_height > 1.0f) rms_height = 1.0f;
  if (peak_height < 0.0f) peak_height = 0.0f;
  if (peak_height > 1.0f) peak_height = 1.0f;

  float rms_px = rms_height * rect.height;
  float peak_px = peak_height * rect.height;

  DrawRectangle((int)(rect.x + rect.width * 0.25f),
                (int)(rect.y + rect.height - rms_px),
                (int)(rect.width * 0.5f),
                (int)rms_px,
                (Color){255, 126, 90, 220});

  DrawLineEx(
    (Vector2){rect.x + rect.width * 0.2f, rect.y + rect.height - peak_px},
    (Vector2){rect.x + rect.width * 0.8f, rect.y + rect.height - peak_px},
    2.0f,
    (Color){255, 245, 210, 230}
  );

  char text[32];
  snprintf(text, sizeof(text), "%.1f dB", rms_db);
  DrawText(text, (int)(rect.x + 6.0f), (int)(rect.y + 6.0f), 10, (Color){230, 230, 230, 170});
}

static void UpdateDrawFrame(void) {
  if (IsKeyPressed(KEY_V)) {
    g_show_vector = g_show_vector ? 0 : 1;
  }

  BeginDrawing();
  ClearBackground((Color){10, 13, 18, 255});

  const float *weights = g_show_vector ? kWeightsFull : kWeightsCompact;
  const char **labels = g_show_vector ? kLabelsFull : kLabelsCompact;
  int count = g_show_vector ? 5 : 4;

  Layout layout = ComputeLayout(GetScreenWidth(), GetScreenHeight(), weights, count);

  for (int i = 0; i < layout.count; i++) {
    DrawTileShell(layout.tiles[i], layout.content[i], labels[i]);
  }

  EnsureSpectrogram((int)layout.content[0].width, (int)layout.content[0].height);
  UpdateSpectrogramColumn();

  if (g_spectro_tex.id > 0) {
    DrawTexturePro(
      g_spectro_tex,
      (Rectangle){0, 0, (float)g_spectro_w, (float)g_spectro_h},
      layout.content[0],
      (Vector2){0, 0},
      0.0f,
      WHITE
    );
  }

  DrawWaveform(layout.content[1]);
  DrawMeter(layout.content[2]);
  if (g_show_vector) {
    DrawGoniometer(layout.content[3]);
    DrawSpectrum(layout.content[4]);
  } else {
    DrawSpectrum(layout.content[3]);
  }

  EndDrawing();
}

EMSCRIPTEN_KEEPALIVE float *wc_get_wave_ptr(void) { return g_wave; }
EMSCRIPTEN_KEEPALIVE float *wc_get_left_ptr(void) { return g_left; }
EMSCRIPTEN_KEEPALIVE float *wc_get_right_ptr(void) { return g_right; }
EMSCRIPTEN_KEEPALIVE float *wc_get_freq_ptr(void) { return g_freq; }
EMSCRIPTEN_KEEPALIVE int wc_get_wave_len(void) { return WC_WAVE_SAMPLES; }
EMSCRIPTEN_KEEPALIVE int wc_get_left_len(void) { return WC_STEREO_SAMPLES; }
EMSCRIPTEN_KEEPALIVE int wc_get_right_len(void) { return WC_STEREO_SAMPLES; }
EMSCRIPTEN_KEEPALIVE int wc_get_freq_len(void) { return WC_FREQ_BINS; }
EMSCRIPTEN_KEEPALIVE void wc_set_show_vector(int show) { g_show_vector = show ? 1 : 0; }
EMSCRIPTEN_KEEPALIVE int wc_get_show_vector(void) { return g_show_vector; }
EMSCRIPTEN_KEEPALIVE void wc_toggle_vector(void) { g_show_vector = g_show_vector ? 0 : 1; }
EMSCRIPTEN_KEEPALIVE void wc_set_size(int width, int height) {
  if (width <= 0 || height <= 0) return;
  g_screen_w = width;
  g_screen_h = height;
  SetWindowSize(g_screen_w, g_screen_h);
}

int main(void) {
  SetConfigFlags(FLAG_WINDOW_RESIZABLE | FLAG_WINDOW_HIGHDPI);
  InitWindow(g_screen_w, g_screen_h, "WaveCandy");
  SetTargetFPS(60);

#ifdef __EMSCRIPTEN__
  emscripten_set_main_loop(UpdateDrawFrame, 0, 1);
#else
  while (!WindowShouldClose()) {
    UpdateDrawFrame();
  }
  CloseWindow();
#endif

  return 0;
}
