# 弹药分类补充核对（2026-10-04）

分类文件：`miniprogram/data/aw/ammo-classification.js`。原始快照保留，不写车辆数据库。每条补充按弹药 ID 关联；分类核实状态与伤害、穿深等参数核实状态独立。

## 补充依据

- 原始资料明确写出的 ATGM-TH / ATGM-Tandem、ATGM-TB / Thermobaric、KEM / Kinetic 细分类用于对应弹头；仅 ATGM 或攻顶/自导等制导标签不作为弹头证据。
- 对 `9M123F`、HJ-13、PF11E、Brimstone、Starstreak、LOSAT、Sokol-V、TAipers、Raybolt 和 BGM-71A 另外核对官方同型号资料，来源随记录保存。
- Raybolt 官方现实段落和游戏段落描述不同，补充只采用游戏 HEAT 分类，不添加未明确核实的串联特性。
- 其他明确 HESH/HEP、PELE、HVAP、HEAB、可编程 HE 与烟幕分类均保留原始来源。

## 待逐车核实的 ATGM

117 条 ATGM 已补出 65 条弹头分类；剩余52条只有通用类型等不足以确认弹头的资料，保持灰色并明确待核实。以下清单供后续游戏内核对，不按实际军事装备属性推定游戏机制。

| 弹药 | 车辆 | 弹药 ID |
| --- | --- | --- |
| 3M7 Drakon ATGM | IT-1 | `e80522c8-dec7-4d42-a80e-d67539aed081` |
| 3UBK10-2 ATGM | T-62M | `5cee0fb4-bb7d-451a-95d6-a46e9f7d6040` |
| 3UBK10-3 ATGM | BMP-3 | `cd0ab1ce-5dd7-4b62-a897-0a34e2d9d34e` |
| 3UBK10M-3 "Kan" ATGM | BMP-3 | `bfd6815c-272a-4df5-895f-3c8b14d0793c` |
| 3UBK10M-3 "Kan" ATGM | BMP-3M | `abe73124-54a4-49fa-a8a3-8ae3a164e9df` |
| 3UBK18 ATGM | Object 187 | `ee01bf30-dc47-48db-9e13-a28fff0320e0` |
| 3UBK23-3 "Arkan" ATGM | BMP-3M | `8861a748-1ab1-4cb2-bf2c-38b9c953650f` |
| 9M111 "Fagot" ATGM | BMD-1P | `ee9fad51-020c-4a65-ad47-d035bc71de85` |
| 9M111 "Fagot" ATGM | BMP-1P | `aaa4c688-2185-4aff-89e7-ac3db367f35a` |
| 9M111M "Faktoriya" ATGM | BMD-1P | `e1088791-de8b-4db7-a8ff-f54b55272dce` |
| 9M111M "Faktoriya" ATGM | BMP-1P | `b9392123-d06c-4509-b3a1-567cef981955` |
| 9M113 "Konkurs" ATGM | OT-64 Cobra | `498f9b8c-1dc7-400b-9dfa-06c41c3ed226` |
| 9M133 ATGM | BMD-2M | `5dd3595e-2785-4288-a9d8-eac76fb4cde5` |
| 9M14 "Malyutka" ATGM | BMD-1 | `30405036-ca36-480c-9a84-a43d6931a21f` |
| 9M14 "Malyutka" ATGM | BMP-1 | `2d4e7e25-c0a6-4b24-be3b-66ccd5000a6a` |
| 9M14 "Malyutka" ATGM | BVP M-80A | `77f7af90-003c-4343-8a67-145471feca77` |
| 9M14 "Malyutka" ATGM | BVP M-80A | `de1baca3-312e-46a7-b60b-7a72ef621283` |
| APS02-100 ATGM | VN20 | `91a01b76-f60b-456b-8ab3-6f17b6f85eab` |
| APS02-100 ATGM | VN20 | `2e7551b6-a028-4bd6-85a7-7a9934437ff2` |
| BGM-71C ITOW ATGM | C13 TUA | `880482e9-23e4-43f7-8b06-be3c4485f111` |
| BGM-71C ITOW ATGM | Wiesel 1 TOW | `e02ee9ee-dfef-478e-b700-620a0ac88bc4` |
| BGM-71F-6 TOW-2B Aero ATGM | Boxer RIWP | `5c1d87af-d207-417f-8716-5d01fa8f4962` |
| BGM-71F-6 TOW-2B Aero ATGM | M1134 Stryker ATGM | `3e1812c8-30a5-4859-81d1-0efde3a61fb4` |
| BGM-71F-6 TOW-2B Aero ATGM | NM142 | `ef4b44dd-0e3f-460c-b2e1-4c1345ae3103` |
| BGM-71F-6 TOW-2B Aero ATGM | ZUBR PSP | `2824e336-de27-4da9-b14e-18ef303e2777` |
| Bulsae-6 AGTM-O | Bulsae-6 | `13c1e435-47de-4aa7-8e8d-490bd4747e61` |
| FGM-148G ATGM | AS21 Redback | `f3cc10d3-a5ea-4dba-8839-70da9caf12d2` |
| FGM-148G ATGM | Boxer RIWP | `a31a197a-b4ab-4ed0-835b-4672f8f0baa4` |
| FGM-148G ATGM | Leclerc T40 | `d4565ddf-d0c9-4281-bc6a-e197a9b3cb68` |
| FGM-148G ATGM | RST-V Shadow | `e5f7ae2b-c5b0-4a31-8f3d-223f67363b8d` |
| GP105/GP2 ATGM | VT5 | `cce0c250-15cf-4d2c-99b0-3f7a05914d82` |
| GP125 ATGM | Type 96A | `059c8eee-083f-4e40-bb5d-5ed0bd8f5d56` |
| GP125 ATGM | Type 96B | `0082d5cd-5610-433a-9606-5043a0a947c0` |
| GP125 ATGM | VT4 | `29acc66f-67ad-470b-a510-40dc1971978e` |
| GP2 ATGM | ST1 | `11b6d3cd-b056-498d-9519-4a77fde2e84f` |
| HOT-2 ATGM | VCAC Mephisto | `76453639-c69b-49f0-a795-92b4fc421a24` |
| HOT-2 ATGM | Wiesel 1 HOT | `6d33f6e7-3d69-42ec-93f6-bc512b48fd00` |
| HOT-2MP ATGM | VCAC Mephisto | `5324844e-9027-4b64-96e0-6aaaca0db26d` |
| HOT-2MP ATGM | Wiesel 1 HOT | `8275c27a-a693-4677-acca-1a755e6c0323` |
| Kombat ATGM | BM Oplot | `30b2cc62-885d-4265-bea6-34cb409f3568` |
| Kornet-E ATGM | BMPT Mod.2000 | `cd8664e6-074a-42a8-9610-b610fb121325` |
| MGM-51A "Shillelagh" ATGM | M551 Sheridan | `21f6d9f0-b4d4-428d-8ebe-607ddea1d6a3` |
| MGM-51A "Shillelagh" ATGM | M60A2 Starship | `705d3be3-e4e9-4bf3-9ac5-b57c5420ff35` |
| MILAN 2T ATGM | VBR | `14dcb3d7-c6a8-4a06-8612-3138c9fa2062` |
| R-2 ATGM | FV101 Scorpion Kastet | `5dac26d5-aeae-46f0-a1ad-f250f0d9a1e8` |
| Red Arrow 10 ATGM-O | AFT-10 | `4442aa0e-976b-4bd9-a931-2a47e8471bf5` |
| Spike-LR II ATGM | Namer IFV | `32ac7a29-ddd4-4d09-83a1-38ecba86a2d2` |
| Sprinter ATGM | T-14 152 Hades | `5adcabe2-5407-46d2-ad3f-74c687a365ce` |
| Swingfire ATGM | FV438 Swingfire | `aa82e3c1-05df-4b33-98bb-3efc69ce6b33` |
| Swingfire SWIG ATGM | FV438 Swingfire | `1527b019-6852-490d-bcab-7c443d9024db` |
| Type 79 ATGM | Type 89 IFV | `cd37dd78-0bee-4791-a6da-949e75c40b9d` |
| ZT3 Ingwe ATGM | VBL Ingwe | `d1908510-837c-4efb-a920-dd719cd2a48f` |
