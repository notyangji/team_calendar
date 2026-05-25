const {
  withAppBuildGradle,
  withAndroidManifest,
  withStringsXml,
} = require("@expo/config-plugins");

// Kakao Maven 저장소 추가
const addKakaoMaven = (config) =>
  withAppBuildGradle(config, (mod) => {
    if (!mod.modResults.contents.includes("devrepo.kakao.com")) {
      mod.modResults.contents = mod.modResults.contents.replace(
        /repositories\s*\{/,
        `repositories {\n        maven { url 'https://devrepo.kakao.com/nexus/content/groups/public/' }`
      );
    }
    return mod;
  });

// AndroidManifest.xml에 카카오 설정 추가
const addKakaoManifest = (config, kakaoAppKey) =>
  withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    const app = manifest.application[0];

    // Android 11+ 패키지 가시성: 카카오톡 설치 여부 확인 권한
    if (!manifest.queries) manifest.queries = [];
    const hasKakaoQuery = manifest.queries.some(
      (q) => q?.package?.[0]?.$?.["android:name"] === "com.kakao.talk"
    );
    if (!hasKakaoQuery) {
      manifest.queries.push({
        package: [{ $: { "android:name": "com.kakao.talk" } }],
      });
    }

    // meta-data
    if (!app["meta-data"]) app["meta-data"] = [];
    const hasMeta = app["meta-data"].some(
      (m) => m.$["android:name"] === "com.kakao.sdk.AppKey"
    );
    if (!hasMeta) {
      app["meta-data"].push({
        $: {
          "android:name": "com.kakao.sdk.AppKey",
          "android:value": kakaoAppKey,
        },
      });
    }

    // intent-filter for kakao callback
    const activity = app.activity?.[0];
    if (activity) {
      if (!activity["intent-filter"]) activity["intent-filter"] = [];
      const hasKakao = activity["intent-filter"].some((f) =>
        f?.data?.some?.((d) => d?.$?.["android:scheme"]?.startsWith("kakao"))
      );
      if (!hasKakao) {
        activity["intent-filter"].push({
          action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
          category: [
            { $: { "android:name": "android.intent.category.DEFAULT" } },
            { $: { "android:name": "android.intent.category.BROWSABLE" } },
          ],
          data: [
            {
              $: {
                "android:host": "kakaolink",
                "android:scheme": `kakao${kakaoAppKey}`,
              },
            },
          ],
        });
      }
    }
    return mod;
  });

// strings.xml에 kakao_app_key 추가
const addKakaoStrings = (config, kakaoAppKey) =>
  withStringsXml(config, (mod) => {
    const strings = mod.modResults.resources.string || [];
    const hasKey = strings.some((s) => s.$?.name === "kakao_app_key");
    if (!hasKey) {
      strings.push({ $: { name: "kakao_app_key" }, _: kakaoAppKey });
    }
    mod.modResults.resources.string = strings;
    return mod;
  });

const withKakao = (config, { kakaoAppKey }) => {
  config = addKakaoMaven(config);
  config = addKakaoManifest(config, kakaoAppKey);
  config = addKakaoStrings(config, kakaoAppKey);
  return config;
};

module.exports = withKakao;
