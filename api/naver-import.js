import { sendJson } from "./_db.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const targetUrl = req.query?.url || getQueryParam(req.url, "url") || "";
  const resolvedUrl = await resolveUrl(targetUrl);
  const articleNumber = extractArticleNumberFromUrl(resolvedUrl) || extractArticleNumberFromUrl(targetUrl);
  if (!articleNumber) {
    sendJson(res, 200, { name: "네이버 매물", naverUrl: targetUrl });
    return;
  }

  sendJson(res, 200, {
    name: `네이버 매물 ${articleNumber}`,
    articleNumber,
    naverUrl: targetUrl,
  });
}

function getQueryParam(url, key) {
  try {
    return new URL(url, "https://jipjip.local").searchParams.get(key);
  } catch {
    return "";
  }
}

async function resolveUrl(url) {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
      },
    });
    return response.url || url;
  } catch {
    return url;
  }
}

function extractArticleNumberFromUrl(url) {
  try {
    const parsed = new URL(url);
    const directArticleNumber =
      parsed.searchParams.get("articleNumber") ||
      parsed.searchParams.get("articleId") ||
      parsed.pathname.match(/\/articles\/(\d+)/)?.[1];
    if (directArticleNumber) return directArticleNumber;

    const layer = parsed.searchParams.get("layer");
    if (!layer) return "";
    const layers = JSON.parse(decompressFromEncodedURIComponent(layer) || "[]");
    return layers.find((item) => item?.id === "article_detail")?.params?.articleId || "";
  } catch {
    return "";
  }
}

function decompressFromEncodedURIComponent(input) {
  if (input == null) return "";
  if (input === "") return null;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$";
  const source = input.replace(/ /g, "+");
  const getNextValue = (index) => alphabet.indexOf(source.charAt(index));
  return decompress(source.length, 32, getNextValue);
}

function decompress(length, resetValue, getNextValue) {
  const dictionary = [0, 1, 2];
  const data = { val: getNextValue(0), position: resetValue, index: 1 };
  let enlargeIn = 4;
  let dictSize = 4;
  let numBits = 3;
  const result = [];
  let bits = readBits(2, data, resetValue, getNextValue);
  let c;

  if (bits === 0) c = String.fromCharCode(readBits(8, data, resetValue, getNextValue));
  else if (bits === 1) c = String.fromCharCode(readBits(16, data, resetValue, getNextValue));
  else if (bits === 2) return "";

  dictionary[3] = c;
  let w = c;
  result.push(c);

  while (true) {
    if (data.index > length) return "";
    let entry;
    c = readBits(numBits, data, resetValue, getNextValue);

    if (c === 0) {
      dictionary[dictSize++] = String.fromCharCode(readBits(8, data, resetValue, getNextValue));
      c = dictSize - 1;
      enlargeIn -= 1;
    } else if (c === 1) {
      dictionary[dictSize++] = String.fromCharCode(readBits(16, data, resetValue, getNextValue));
      c = dictSize - 1;
      enlargeIn -= 1;
    } else if (c === 2) {
      return result.join("");
    }

    if (enlargeIn === 0) {
      enlargeIn = Math.pow(2, numBits);
      numBits += 1;
    }

    if (dictionary[c]) entry = dictionary[c];
    else if (c === dictSize) entry = w + w.charAt(0);
    else return null;

    result.push(entry);
    dictionary[dictSize++] = w + entry.charAt(0);
    enlargeIn -= 1;
    w = entry;

    if (enlargeIn === 0) {
      enlargeIn = Math.pow(2, numBits);
      numBits += 1;
    }
  }
}

function readBits(bitCount, data, resetValue, getNextValue) {
  let bits = 0;
  let power = 1;
  const maxpower = Math.pow(2, bitCount);
  while (power !== maxpower) {
    const resb = data.val & data.position;
    data.position >>= 1;
    if (data.position === 0) {
      data.position = resetValue;
      data.val = getNextValue(data.index++);
    }
    bits |= (resb > 0 ? 1 : 0) * power;
    power <<= 1;
  }
  return bits;
}
