import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ColorPicker } from './ColorPicker';

describe('color selection controls', () => {
  it('offers cancellation and previews the card before a manual play', () => {
    const html = renderToStaticMarkup(<ColorPicker playerName="あなた" card={{ id: 'wild', kind: 'wild', color: null }} onSelect={() => {}} onCancel={() => {}}/>);
    expect(html).toContain('キャンセルして手札に戻る'); expect(html).toContain('色選択を取り消す');
    expect(html).toContain('色を選ぶと、このカードを出します。'); expect(html).toContain('赤にしてカードを出す');
    expect(html).toContain('ワイルド');
  });
  it('does not offer undo for already committed automatic draws or deferred color choices', () => {
    const html = renderToStaticMarkup(<ColorPicker playerName="あなた" onSelect={() => {}}/>);
    expect(html).not.toContain('キャンセル'); expect(html).not.toContain('色選択を取り消す'); expect(html).toContain('あなた が場の色を選びます');
    expect((html.match(/<button/g) ?? []).length).toBe(4);
  });
});
