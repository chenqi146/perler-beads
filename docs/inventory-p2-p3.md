# 豆仓 P2 / P3 约定

MVP 批次台账已交付。交互增强后，P2 的采购对比与色统计角标、P3 的制作完成出库（含 craftSession 幂等与 toast 撤销）已部分落地。

## 已落地（交互六项）

- 极速入库 sheet + 再来一包
- 总览三问：快见底 / 最近 / 全部（`updatedAt` + 阈值 50）
- toast 撤销（45s）
- 搜色容错与相近色
- 出库「从图纸带入」+ 拼豆完成页「从豆仓扣减」
- 采购清单库存/缺口列；编辑色统计仓角标

## P2 剩余（可选抛光）

- 编辑页更多表面（自定义色板勾选列表）同步角标
- 采购清单一键跳转缺色极速入库

## P3 剩余（可选抛光）

- 完成页桌面端同样露出「从豆仓扣减」（目前主要在移动底栏）
- 按 `craft_session_id` 加 DB 唯一索引（应用层幂等已做）
- 完成页「撤销扣减」入口（现依赖 toast 45s）

### API 约定（已实现）

`POST /api/inventory/outbound`

```json
{
  "reason": "craft",
  "craftSessionId": "<session-id>",
  "note": "作品完成扣减",
  "lines": [{ "hex": "#AABBCC", "quantity": 120 }]
}
```

- 同 `craftSessionId` 且 `status=posted` → 返回已有 `outboundId` + `idempotent: true`
- 库存不足：409 + `shortfallHexes[]`
- 撤销：`POST /api/inventory/outbound/:id/void`
