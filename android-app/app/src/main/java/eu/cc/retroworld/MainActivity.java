package eu.cc.retroworld;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.os.Handler;
import android.util.DisplayMetrics;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;
import java.util.concurrent.atomic.AtomicBoolean;
import android.widget.Toast;

/** Retro World — opens the site in Mobile Mode, full screen, as an app. */
public class MainActivity extends Activity {
    private static final String HOME = "https://retroworld.eu.cc/?view=mobile&app=1";
    private static final int FILE_REQ = 7;
    private WebView web;
    private FrameLayout root;
    private View customView;
    private WebChromeClient.CustomViewCallback customCb;
    private ValueCallback<Uri[]> filePathCb;
    private long lastBack = 0;
    // ---- AdMob ----
    private AdView banner;
    private InterstitialAd interstitial;
    private final AtomicBoolean adsStarted = new AtomicBoolean(false);
    private final Handler h = new Handler();
    private boolean inGame = false;
    private long gameStart = 0, lastInterstitial = 0;

    @SuppressLint({"SetJavaScriptEnabled"})
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        root = new FrameLayout(this);
        root.setBackgroundColor(0xFF121316);
        web = new WebView(this);
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.addView(web, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        banner = new AdView(this);
        banner.setVisibility(View.GONE);
        col.addView(banner, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        root.addView(col, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setBuiltInZoomControls(false);
        s.setSupportZoom(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        s.setUserAgentString(s.getUserAgentString() + " RetroWorldApp/1.1");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);
        web.setBackgroundColor(0xFF121316);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);

        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                String h = u.getHost() == null ? "" : u.getHost();
                if (h.endsWith("retroworld.eu.cc") || h.endsWith("digitaleye2k-lang.github.io")) return false;
                if ("https".equals(u.getScheme()) && (h.contains("google") || h.contains("doubleclick") || h.contains("googlesyndication"))) return false; // ads/frames
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) { }
                return true;
            }
            @Override public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame()) {
                    v.loadData("<html><body style='margin:0;background:#121316;color:#e8eaed;font-family:sans-serif;display:grid;place-items:center;height:100vh;text-align:center'>"
                        + "<div><div style='font-size:64px'>📡</div><h2>No connection</h2><p style='color:#9aa0a6'>Retro World needs internet to load games.</p>"
                        + "<a href='" + HOME + "' style='display:inline-block;margin-top:14px;padding:12px 28px;border-radius:24px;background:#7bd88f;color:#00391a;text-decoration:none;font-weight:700'>Try again</a></div></body></html>", "text/html", "UTF-8");
                }
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onShowCustomView(View v, CustomViewCallback cb) {
                if (customView != null) { cb.onCustomViewHidden(); return; }
                customView = v; customCb = cb;
                root.addView(v, new FrameLayout.LayoutParams(-1, -1));
                web.setVisibility(View.GONE);
            }
            @Override public void onHideCustomView() {
                if (customView == null) return;
                root.removeView(customView); customView = null; web.setVisibility(View.VISIBLE);
                if (customCb != null) customCb.onCustomViewHidden();
            }
            @Override public void onPermissionRequest(PermissionRequest r) { r.deny(); }
            @Override public boolean onShowFileChooser(WebView w, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (filePathCb != null) filePathCb.onReceiveValue(null);
                filePathCb = cb;
                try { startActivityForResult(p.createIntent(), FILE_REQ); }
                catch (Exception e) { filePathCb = null; return false; }
                return true;
            }
        });
        web.setDownloadListener((url, ua, cd, mime, len) -> {
            try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); }
            catch (Exception e) { Toast.makeText(this, "Download not supported here", Toast.LENGTH_SHORT).show(); }
        });
        immersive();
        startAdsWithConsent();
        if (b != null) web.restoreState(b); else web.loadUrl(HOME);
    }

    // ---------- AdMob: consent (UMP) -> init -> adaptive banner + occasional interstitial ----------
    private void startAdsWithConsent() {
        final ConsentInformation ci = UserMessagingPlatform.getConsentInformation(this);
        ci.requestConsentInfoUpdate(this, new ConsentRequestParameters.Builder().build(),
            () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(this, err -> { if (ci.canRequestAds()) initAds(); }),
            err -> { if (ci.canRequestAds()) initAds(); });
        if (ci.canRequestAds()) initAds();
    }
    private void initAds() {
        if (!adsStarted.compareAndSet(false, true)) return;
        MobileAds.initialize(this, st -> runOnUiThread(() -> {
            DisplayMetrics dm = getResources().getDisplayMetrics();
            int w = (int) (dm.widthPixels / dm.density);
            banner.setAdUnitId(getString(R.string.admob_banner_id));
            banner.setAdSize(AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(this, w));
            banner.setAdListener(new AdListener() { @Override public void onAdFailedToLoad(LoadAdError e) { banner.setVisibility(View.GONE); } @Override public void onAdLoaded() { if (!inGame) banner.setVisibility(View.VISIBLE); } });
            banner.loadAd(new AdRequest.Builder().build());
            loadInterstitial();
            pollGameState();
        }));
    }
    private void loadInterstitial() {
        InterstitialAd.load(this, getString(R.string.admob_interstitial_id), new AdRequest.Builder().build(), new InterstitialAdLoadCallback() {
            @Override public void onAdLoaded(InterstitialAd ad) { interstitial = ad; }
            @Override public void onAdFailedToLoad(LoadAdError e) { interstitial = null; }
        });
    }
    /** Banner is hidden while a game is running (never over the controls); an interstitial may show right AFTER a game is closed. */
    private void pollGameState() {
        web.evaluateJavascript("document.body&&document.body.classList.contains('game-active')?'1':'0'", v -> {
            boolean g = v != null && v.contains("1");
            if (g && !inGame) { inGame = true; gameStart = System.currentTimeMillis(); banner.setVisibility(View.GONE); }
            else if (!g && inGame) {
                inGame = false; banner.setVisibility(View.VISIBLE);
                long n = System.currentTimeMillis();
                if (interstitial != null && n - gameStart > 90_000 && n - lastInterstitial > 240_000) {
                    final InterstitialAd ad = interstitial; interstitial = null; lastInterstitial = n;
                    ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                        @Override public void onAdDismissedFullScreenContent() { loadInterstitial(); immersive(); }
                        @Override public void onAdFailedToShowFullScreenContent(AdError e) { loadInterstitial(); }
                    });
                    ad.show(MainActivity.this);
                }
            }
            h.postDelayed(this::pollGameState, 1200);
        });
    }

    private void immersive() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }
    @Override public void onWindowFocusChanged(boolean f) { super.onWindowFocusChanged(f); if (f) immersive(); }
    @Override protected void onSaveInstanceState(Bundle o) { super.onSaveInstanceState(o); web.saveState(o); }
    @Override protected void onPause() { super.onPause(); web.onPause(); if (banner != null) banner.pause(); }
    @Override protected void onResume() { super.onResume(); web.onResume(); immersive(); if (banner != null) banner.resume(); }
    @Override protected void onDestroy() { h.removeCallbacksAndMessages(null); if (banner != null) banner.destroy(); if (web != null) { root.removeView(web); web.destroy(); } super.onDestroy(); }

    @Override protected void onActivityResult(int req, int res, Intent data) {
        if (req == FILE_REQ && filePathCb != null) {
            filePathCb.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data));
            filePathCb = null;
        } else super.onActivityResult(req, res, data);
    }

    @Override public void onBackPressed() {
        if (customView != null) { web.getWebChromeClient().onHideCustomView(); return; }
        // let the page handle Back first (close game / detail sheet), then exit on double press
        web.evaluateJavascript("(function(){var p=document.getElementById('player');if(p&&p.classList.contains('open')){var c=p.querySelector('.close,.player-x');if(c){c.click();return 'h'}}"
            + "var d=document.getElementById('mDetail');if(d&&d.classList.contains('open')){d.classList.remove('open');return 'h'}return 'n'})()", v -> {
            if (v != null && v.contains("h")) return;
            if (web.canGoBack()) { web.goBack(); return; }
            long n = System.currentTimeMillis();
            if (n - lastBack < 1800) finish();
            else { lastBack = n; Toast.makeText(this, "Press back again to exit", Toast.LENGTH_SHORT).show(); }
        });
    }
}
