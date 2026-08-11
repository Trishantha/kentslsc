import json
import re
import sys
from deep_translator import GoogleTranslator

PLACEHOLDER_RE = re.compile(r"(\{[^}]+\})")

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

def translate_text(text, target):
    if not isinstance(text, str) or not text.strip():
        return text
    protected, placeholders = protect_placeholders(text)
    translated = GoogleTranslator(source='en', target=target).translate(protected)
    return restore_placeholders(translated, placeholders)

def translate_obj(obj, target):
    if isinstance(obj, dict):
        return {k: translate_obj(v, target) for k, v in obj.items()}
    if isinstance(obj, list):
        return [translate_obj(v, target) for v in obj]
    return translate_text(obj, target)

def main():
    target = sys.argv[1]
    with open('apps/web/messages/en.json', 'r', encoding='utf-8') as f:
        en = json.load(f)
    translated = translate_obj(en, target)
    with open(f'apps/web/messages/{target}.json', 'w', encoding='utf-8') as f:
        json.dump(translated, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print(f"Translated to apps/web/messages/{target}.json")

if __name__ == '__main__':
    main()
