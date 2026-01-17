#include "raylib.h"
#include <math.h>
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

static const float kColWeights[5] = {1.1f, 1.5f, 0.55f, 1.0f, 1.1f};
static const char *kLabels[5] = {
  "Spectrogram",
  "Oscilloscope",
  "Level",
  "Vectorscope",
  "Spectrum"
};

static Layout ComputeLayout(int width, int height) {
  Layout layout = {0};
  float pad = 10.0f;
  float gap = 8.0f;
  float label_h = 12.0f;
  float label_gap = 6.0f;
  float inner_pad = 8.0f;

  float available_w = (float)width - pad * 2.0f - gap * 4.0f;
  if (available_w < 0.0f) available_w = (float)width;

  float sum = 0.0f;
  for (int i = 0; i < 5; i++) {
    sum += kColWeights[i];
  }

  float x = pad;
  float tile_h = (float)height - pad * 2.0f;
  for (int i = 0; i < 5; i++) {
    float w = (available_w * kColWeights[i]) / sum;
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

static void DrawTileShell(Rectangle tile, Rectangle content, const char *label) {
  Color tile_bg = (Color){7, 11, 18, 220};
  Color tile_border = (Color){32, 42, 56, 200};
  Color content_bg = (Color){6, 9, 14, 230};
  Color label_color = (Color){190, 198, 208, 200};

  DrawRectangleRounded(tile, 0.12f, 8, tile_bg);
  DrawRectangleRoundedLines(tile, 0.12f, 8, 1.0f, tile_border);
  DrawText(label, (int)(tile.x + 10.0f), (int)(tile.y + 6.0f), 10, label_color);
  DrawRectangleRounded(content, 0.08f, 6, content_bg);
}

static void DrawWaveform(Rectangle rect) {
  float mid = rect.y + rect.height * 0.5f;
  Color stroke = (Color){252, 214, 142, 225};
  Color midline = (Color){255, 255, 255, 32};

  for (int i = 1; i < WC_WAVE_SAMPLES; i++) {
    float t0 = (float)(i - 1) / (float)(WC_WAVE_SAMPLES - 1);
    float t1 = (float)i / (float)(WC_WAVE_SAMPLES - 1);
    float x0 = rect.x + t0 * rect.width;
    float x1 = rect.x + t1 * rect.width;
    float y0 = mid - g_wave[i - 1] * rect.height * 0.42f;
    float y1 = mid - g_wave[i] * rect.height * 0.42f;
    DrawLineV((Vector2){x0, y0}, (Vector2){x1, y1}, stroke);
  }

  DrawLineV((Vector2){rect.x, mid}, (Vector2){rect.x + rect.width, mid}, midline);
}

static void DrawSpectrum(Rectangle rect) {
  Color stroke = (Color){140, 220, 255, 225};
  for (int i = 1; i < WC_FREQ_BINS; i++) {
    float t0 = (float)(i - 1) / (float)(WC_FREQ_BINS - 1);
    float t1 = (float)i / (float)(WC_FREQ_BINS - 1);
    float x0 = rect.x + t0 * rect.width;
    float x1 = rect.x + t1 * rect.width;
    float y0 = rect.y + rect.height - g_freq[i - 1] * rect.height * 0.9f;
    float y1 = rect.y + rect.height - g_freq[i] * rect.height * 0.9f;
    DrawLineV((Vector2){x0, y0}, (Vector2){x1, y1}, stroke);
  }
}

static void DrawGoniometer(Rectangle rect) {
  Color grid = (Color){255, 255, 255, 22};
  Color stroke = (Color){255, 128, 92, 205};

  float mid_x = rect.x + rect.width * 0.5f;
  float mid_y = rect.y + rect.height * 0.5f;
  DrawLineV((Vector2){mid_x, rect.y}, (Vector2){mid_x, rect.y + rect.height}, grid);
  DrawLineV((Vector2){rect.x, mid_y}, (Vector2){rect.x + rect.width, mid_y}, grid);

  for (int i = 1; i < WC_STEREO_SAMPLES; i += 2) {
    float x0 = rect.x + (g_left[i - 1] * 0.45f + 0.5f) * rect.width;
    float y0 = rect.y + (g_right[i - 1] * -0.45f + 0.5f) * rect.height;
    float x1 = rect.x + (g_left[i] * 0.45f + 0.5f) * rect.width;
    float y1 = rect.y + (g_right[i] * -0.45f + 0.5f) * rect.height;
    DrawLineV((Vector2){x0, y0}, (Vector2){x1, y1}, stroke);
  }
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
  BeginDrawing();
  ClearBackground((Color){10, 13, 18, 255});

  Layout layout = ComputeLayout(GetScreenWidth(), GetScreenHeight());

  for (int i = 0; i < 5; i++) {
    DrawTileShell(layout.tiles[i], layout.content[i], kLabels[i]);
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
  DrawGoniometer(layout.content[3]);
  DrawSpectrum(layout.content[4]);

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
