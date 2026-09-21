import json
import re
import sys
import time
from deep_translator import GoogleTranslator, MyMemoryTranslator
from deep_translator.exceptions import TooManyRequests, RequestError

PLACEHOLDER_RE = re.compile(r"(\{[^}]+\})")
BATCH_SIZE = 10
MAX_RETRIES = 5

def protect_placeholders(text):
    placeholders = []
    def repl(match):
        placeholders.append(match.group(0))
        return f"__PH{len(placeholders)-1}__"
    return PLACEHOLDER_RE.sub(repl, text), placeholders

def restore_placeholders(text, placeholders):
    for i, ph in enumerate(placeholders):
        text = text.replace(f"__PH{i}__", ph)
    return text

def get_path(obj, path):
    node = obj
    for part in path.split('.'):
        if not isinstance(node, dict) or part not in node:
            return None
        node = node[part]
    return node

def set_path(obj, path, value):
    parts = path.split('.')
    node = obj
    for part in parts[:-1]:
        node = node[part]
    node[parts[-1]] = value

def collect_missing(en, existing, prefix=''):
    """Paths present in en but absent from the existing translation."""
    missing = []
    if isinstance(en, dict):
        for k, v in en.items():
            path = f'{prefix}.{k}' if prefix else k
            ex = existing.get(k) if isinstance(existing, dict) else None
            if isinstance(v, dict):
                missing += collect_missing(v, ex if isinstance(ex, dict) else {}, path)
            elif not isinstance(ex, str) or not ex:
                missing.append((path, v))
    return missing

MYMEMORY_CODES = { 'si': 'si-LK', 'ta': 'ta-IN' }

def translate_chunk(chunk, target):
    """Translate one chunk of strings. Falls back to MyMemory when Google rate-limits."""
    translator = GoogleTranslator(source='en', target=target)
    joined = '\n'.join(chunk)
    for attempt in range(MAX_RETRIES):
        try:
            return translator.translate(joined).split('\n')
        except (TooManyRequests, RequestError):
            if attempt < MAX_RETRIES - 1:
                time.sleep(5 * (attempt + 1))
    # Google is rate-limiting this IP — fall back to MyMemory (one string per request)
    fallback = MyMemoryTranslator(source='en-GB', target=MYMEMORY_CODES.get(target, target))
    return [fallback.translate(text) for text in chunk]

def translate_batch(texts, target):
    """Translate a list of strings, batching them into one request per chunk."""
    translator = GoogleTranslator(source='en', target=target)
    results = []
    for start in range(0, len(texts), BATCH_SIZE):
        chunk = texts[start:start + BATCH_SIZE]
        protected = []
        placeholder_maps = []
        for text in chunk:
            p, ph = protect_placeholders(text)
            protected.append(p)
            placeholder_maps.append(ph)
        lines = translate_chunk(protected, target)
        time.sleep(0.5)
        if len(lines) != len(chunk):
            # Line structure shifted — re-do this chunk one string at a time
            lines = []
            for text in chunk:
                single = translate_chunk([text], target)
                lines.extend(single)
                time.sleep(0.5)
        for line, ph in zip(lines, placeholder_maps):
            results.append(restore_placeholders(line, ph))
    return results

def main():
    target = sys.argv[1]
    with open('apps/web/messages/en.json', 'r', encoding='utf-8') as f:
        en = json.load(f)
    target_file = f'apps/web/messages/{target}.json'
    try:
        with open(target_file, 'r', encoding='utf-8') as f:
            existing = json.load(f)
    except FileNotFoundError:
        existing = {}

    # Seed the output with the existing translation (merged over en structure)
    def merge(en_node, ex_node):
        if isinstance(en_node, dict):
            result = {}
            for k, v in en_node.items():
                ex_v = ex_node.get(k) if isinstance(ex_node, dict) else None
                result[k] = merge(v, ex_v)
            return result
        return en_node if not isinstance(ex_node, str) or not ex_node else ex_node

    output = merge(en, existing)
    missing = collect_missing(en, existing)
    if missing:
        print(f'{len(missing)} new strings to translate...')
        translated = translate_batch([text for _, text in missing], target)
        for (path, _), value in zip(missing, translated):
            set_path(output, path, value)
    else:
        print('No new strings to translate.')

    with open(target_file, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print(f'Wrote {target_file}')

if __name__ == '__main__':
    main()
