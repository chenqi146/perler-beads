import { describe, expect, it } from 'vitest';
import { parseInboundCsv } from './csv';

describe('parseInboundCsv', () => {
  it('parses brand/key/qty/hex export format', () => {
    const csv = `品牌,编号,数量,颜色,状态,添加时间
MARD,A01,4945,#FAF4C8,启用,"2026-07-28 12:21:45"
MARD,A02,1970,#FFFFD5,启用,"2026-07-28 12:21:45"
MARD,A03,2820,#FEFF8B,停用,"2026-07-28 12:21:45"`;

    const result = parseInboundCsv(csv, 'MARD');
    expect(result.errors).toEqual([]);
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0]).toMatchObject({
      hex: '#FAF4C8',
      quantity: 4945,
    });
    expect(result.lines[1].hex).toBe('#FFFFD5');
    expect(result.lines[1].quantity).toBe(1970);
  });

  it('still parses simple key,qty format', () => {
    const csv = `色号,数量
A01,100
#FAF4C8,50`;
    const result = parseInboundCsv(csv, 'MARD');
    expect(result.lines.length).toBe(2);
    expect(result.lines[0].hex).toBe('#FAF4C8');
    expect(result.lines[0].quantity).toBe(100);
  });
});
