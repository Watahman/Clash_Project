const JSON_CONTENT_TYPE = "application/json; charset=utf-8";
const ADS_CONTEXT_PATH = "/api/ads-context";
const ISO_ALPHA_2_COUNTRIES = new Set(
    "AF,AL,DZ,AS,AD,AO,AI,AQ,AG,AR,AM,AW,AU,AT,AZ,BS,BH,BD,BB,BY,BE,BZ,BJ,BM,BT,BO,BQ,BA,BW,BV,BR,IO,BN,BG,BF,BI,CV,KH,CM,CA,KY,CF,TD,CL,CN,CX,CC,CO,KM,CG,CD,CK,CR,CI,HR,CU,CW,CY,CZ,DK,DJ,DM,DO,EC,EG,SV,GQ,ER,EE,SZ,ET,FK,FO,FJ,FI,FR,GF,PF,TF,GA,GM,GE,DE,GH,GI,GR,GL,GD,GP,GU,GT,GG,GN,GW,GY,HT,HM,VA,HN,HK,HU,IS,IN,ID,IR,IQ,IE,IM,IL,IT,JM,JP,JE,JO,KZ,KE,KI,KP,KR,KW,KG,LA,LV,LB,LS,LR,LY,LI,LT,LU,MO,MG,MW,MY,MV,ML,MT,MH,MQ,MR,MU,YT,MX,FM,MD,MC,MN,ME,MS,MA,MZ,MM,NA,NR,NP,NL,NC,NZ,NI,NE,NG,NU,NF,MK,MP,NO,OM,PK,PW,PS,PA,PG,PY,PE,PH,PN,PL,PT,PR,QA,RE,RO,RU,RW,BL,SH,KN,LC,MF,PM,VC,WS,SM,ST,SA,SN,RS,SC,SL,SG,SX,SK,SI,SB,SO,ZA,GS,SS,ES,LK,SD,SR,SJ,SE,CH,SY,TW,TJ,TZ,TH,TL,TG,TK,TO,TT,TN,TR,TM,TC,TV,UG,UA,AE,GB,US,UM,UY,UZ,VU,VE,VN,VG,VI,WF,EH,YE,ZM,ZW".split(",")
);
const PROTECTED_ADS_COUNTRIES = new Set(
    "AT,BE,BG,HR,CY,CZ,DK,EE,FI,FR,DE,GR,HU,IE,IT,LV,LT,LU,MT,NL,PL,PT,RO,SK,SI,ES,SE,IS,LI,NO,GB,CH".split(",")
);

export function isAdsContextPath(pathname) {
    return String(pathname || "").toLowerCase() === ADS_CONTEXT_PATH;
}

function adsCountryClassification(request) {
    const country = String(request.cf?.country || "").trim().toUpperCase();
    if (!ISO_ALPHA_2_COUNTRIES.has(country) || country === "XX") return "unknown";
    return PROTECTED_ADS_COUNTRIES.has(country) ? "protected" : "non-protected";
}

export function adsContextResponse(request) {
    if (request.method !== "GET") {
        return new Response(null, {
            status: 405,
            headers: {
                Allow: "GET",
                "Cache-Control": "private, no-store",
                "X-Content-Type-Options": "nosniff"
            }
        });
    }

    const classification = adsCountryClassification(request);
    const body = JSON.stringify({
        consentRequired: classification !== "non-protected",
        classification
    });
    return new Response(body, {
        headers: {
            "Content-Type": JSON_CONTENT_TYPE,
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff"
        }
    });
}
