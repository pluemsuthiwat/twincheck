# TwinCheck

เปรียบเทียบไฟล์ config สองไฟล์ตามความหมาย (semantic diff) เริ่มจาก XML / Aruba ClearPass Policy Manager export
ประมวลผลใน browser ทั้งหมด ไม่มีการส่งไฟล์ออกจากเครื่อง

## ใช้งาน

```sh
pnpm install
pnpm dev        # http://localhost:5173
pnpm test       # unit tests + ClearPass fixtures
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
| `fixtures/clearpass` | ไฟล์ export ตัวอย่างสำหรับ test |

## เพิ่ม format / profile ใหม่

- **Format ใหม่** (JSON, YAML, …): เขียน adapter ที่คืน `TNode` เหมือน `format-xml` แล้วใช้ engine เดิมได้ทันที
- **Profile ใหม่**: สร้าง `Profile` ที่มี `detect`, `ignore`, `rules` (`key`, `ordered`, `label`, `kind`, `ignoreAttrs`) แล้วเพิ่มเข้า `PROFILES` ใน `apps/web/src/engine.ts`

## หมายเหตุด้านความปลอดภัย

ไฟล์ ClearPass export มี secret แบบ plaintext (Proxy secret, LDAP bind password, privateKeyPassword ฯลฯ)
UI จะ mask ไว้เป็นค่าเริ่มต้น ส่วนไฟล์ใน `fixtures/` เป็นข้อมูลจาก lab ควรลบหรือแทน secret ก่อน push ขึ้น repo สาธารณะ
