# TwinCheck

เปรียบเทียบไฟล์ config สองไฟล์ตามความหมาย (semantic diff) เริ่มจาก XML / Aruba ClearPass Policy Manager export
ประมวลผลใน browser ทั้งหมด ไม่มีการส่งไฟล์ออกจากเครื่อง

## ใช้งาน

```sh
pnpm install
pnpm dev        # เปิด desktop app (Tauri)
pnpm web:dev    # รันแบบเว็บที่ http://localhost:5173
pnpm test       # unit tests (core, ClearPass profile, UI helpers)
pnpm typecheck
pnpm build      # apps/web/dist (static, เปิดได้โดยไม่ต้องมี server)
```

## โครงสร้าง

| Package | หน้าที่ |
|---|---|
| `packages/core` | Tree diff engine กลาง: จับคู่ object ด้วย key, LCS สำหรับ list ที่ลำดับมีผล, canonicalize, Profile |
| `packages/format-xml` | แปลง XML เป็น tree กลาง (`parseXml`) และกลับเป็น XML (`serializeXml`) |
| `packages/profile-clearpass` | กฎเฉพาะ ClearPass: หมวด, key ของแต่ละ object, Rule แบบ ordered, ข้าม `exportTime` และ internal ID |
| `apps/web` | React + Vite + Tailwind UI, diff รันใน Web Worker, Monaco สำหรับ Raw XML |
| `apps/desktop` | Tauri 2 shell ของ `apps/web` + updater (เช็กอัปเดตจาก GitHub Releases) |
| `fixtures/clearpass` | ไฟล์ export ตัวอย่างสำหรับ test |

## อ่านหน้าความแตกต่าง

**ตัวเลข `+N −N ~N`** (sidebar, หัวหมวด, หัวจอ) นับ "จุดที่เปลี่ยน" ทุกชั้นข้างใน เลขของแถวแม่ = ผลรวมของแถวลูก
- `+` มีแค่ใน B (เพิ่มทั้งก้อนนับ 1) · `−` มีแค่ใน A · `~` แก้ค่าหรือย้ายตำแหน่ง (แก้หลาย field ใน element เดียวนับ 1)
- ยอดรวมที่หัวจอ = "All differences" ในหน้า Overview

**สี** ใช้กติกาเดียวทุกตาราง: ช่อง A แดง = ค่าเดิม / มีแค่ใน A · ช่อง B เขียว = ค่าใหม่ / มีแค่ใน B · เหลือง = สลับตำแหน่ง
หัวหมวดใหญ่ใช้ไอคอนโฟลเดอร์สีน้ำเงิน ไม่ใช้สีสถานะ

**มาตรฐานการแสดงผล** (ใช้กับทุก object ไม่ผูกกับชื่อ element)

| ข้อมูลใน XML | แสดงเป็น |
|---|---|
| attribute ของ element และลูกแบบ `name`/`value` (เช่น NVPair ของ Auth Source) | ตาราง `Field \| A \| B` เรียงตามลำดับใน XML ค่าที่ไม่เปลี่ยนซ่อนไว้ใต้ "Show unchanged fields" |
| list ของข้อความ (`<string>` ใน AuthMethodNameList ฯลฯ) | ตาราง `# \| A \| B` แถวละรายการ |
| list ของรายการบรรทัดเดียว (เงื่อนไข, ผลลัพธ์, attribute ของ profile) | ตาราง `# \| A \| B` แต่ละช่องแสดง field (type / name / operator / value) field ที่เปลี่ยนเป็นตัวหนา |
| list ที่ลำดับมีผล (RuleList) | ตาราง `# \| A \| B` แถวละ Rule: เงื่อนไขแต่ละข้อเป็น field (type / name / operator / value) คั่นด้วย AND/OR แล้วตามด้วย `THEN` ชื่อผลลัพธ์ (เช่น Role, Enforcement-Profile) อยู่คอลัมน์ค่า ส่วนรายการบรรทัดละตัวมี `#1`, `#2` อยู่คอลัมน์ซ้ายใต้ THEN แถวแสดงครบทั้งข้อจึงไม่มีปุ่มกาง ถึงจะมี Rule เดียวก็ยังเป็นตาราง |
| element ห่อที่ไม่มีชื่อ (Policy, RuleList, AttributeList, ResultList) | หัวข้อเล็กในกล่องแม่ ไม่ใช่กล่องแยก |
| object อื่น | กล่องซ้อน |

**list ที่ลำดับมีผล:** ถ้าแค่สลับลำดับหรือเพิ่ม/ลบที่ท้าย แถว #n คือรายการลำดับที่ n ของแต่ละไฟล์ (สลับจะเห็นไขว้กัน `1|2, 2|1`)
ถ้าเพิ่ม/ลบตรงกลาง รายการเดียวกันอยู่แถวเดียวกัน เพื่อไม่ให้แถวหลังจากนั้นเหลื่อมทั้งหมด

## เพิ่ม format / profile ใหม่

- **Format ใหม่** (JSON, YAML, …): เขียน adapter ที่คืน `TNode` เหมือน `format-xml` แล้วใช้ engine เดิมได้ทันที
- **Profile ใหม่**: สร้าง `Profile` ที่มี `detect`, `ignore`, `rules` (`key`, `ordered`, `label`, `kind`, `ignoreAttrs`) แล้วเพิ่มเข้า `PROFILES` ใน `apps/web/src/engine.ts`

## ออกเวอร์ชันใหม่ / อัปเดตอัตโนมัติ

แอป desktop เช็กอัปเดตจาก GitHub Releases ตอนเปิดแอป (เงียบๆ) และเมื่อกด **Check for updates** ในหน้า About
ไฟล์อัปเดตต้องมีลายเซ็นตรงกับ `pubkey` ใน `tauri.conf.json` ถึงจะติดตั้งได้

ตั้งค่าครั้งเดียว (repo ต้องเป็น public):
- GitHub → Settings → Secrets and variables → Actions → เพิ่ม `TAURI_SIGNING_PRIVATE_KEY` (เนื้อหาไฟล์ `~/.tauri/twincheck.key`) และ `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (เว้นว่าง)
- **สำรอง `~/.tauri/twincheck.key` ไว้ให้ดี** ถ้าหาย แอปที่ติดตั้งไปแล้วจะรับอัปเดตใหม่ไม่ได้

ทุกครั้งที่ออกเวอร์ชัน:

```sh
npm version minor --no-git-tag-version    # แก้ "version" ใน package.json ที่ root
git commit -am "Release v1.1.0"
git tag v1.1.0 && git push && git push --tags
```

Workflow `.github/workflows/release.yml` จะ build macOS (Apple Silicon + Intel) และ Windows แล้วสร้าง **draft release**
กด Publish ใน GitHub Releases เมื่อพร้อม แอปที่ติดตั้งไว้จะเห็นอัปเดตหลังจากนั้น

## หมายเหตุด้านความปลอดภัย

ไฟล์ ClearPass export มี secret แบบ plaintext (Proxy secret, LDAP bind password, privateKeyPassword ฯลฯ)
UI จะ mask ไว้เป็นค่าเริ่มต้น ส่วนไฟล์ใน `fixtures/` เป็นข้อมูลจาก lab ควรลบหรือแทน secret ก่อน push ขึ้น repo สาธารณะ

## License

MIT — ดู [LICENSE](LICENSE)
