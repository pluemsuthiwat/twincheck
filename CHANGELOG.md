# Changelog

## Unreleased

### หน้าความแตกต่าง
- แถว Rule ใน RuleList (Enforcement Policy, Role Mapping) แสดงเงื่อนไขแต่ละข้อเป็น field type / name / operator / value คั่นด้วย AND/OR แล้วตามด้วย `THEN` กับ Enforcement-Profile / Role แสดง profile บรรทัดละตัวมีเลข `#1`, `#2` แทนบรรทัด `IF … THEN …`
- Rule / เงื่อนไข / attribute ที่เปลี่ยน ไฮไลต์เฉพาะค่าที่เปลี่ยน (A แดง, B เขียว) ไม่ทาสีทั้งช่อง ส่วนที่มีแค่ฝั่งเดียวยังทาสีทั้งช่องเหมือนเดิม
- แถว Rule ไม่มีปุ่มกางแล้ว เพราะแถวแสดงครบทั้งข้อ กดจาก Overview จะเลื่อนไปที่แถวนั้นและตีกรอบให้
- Role Mapping / Enforcement Policy: หัวข้อ Policy อยู่บนสุด ครอบ field ของ object (dftRoleName, name, …) และตาราง Rule ไม่มีหัวข้อ RuleList แยก field ทั้งหมดเรียงตามลำดับใน XML
- field ที่เป็นรายการคั่นด้วยคอมมา (เช่น `members` ของ NAD Group) แสดงบรรทัดละรายการมี `#1`, `#2` ไฮไลต์เฉพาะรายการที่มีแค่ฝั่งเดียว ส่วนหน้า Overview แสดงเฉพาะรายการที่ออกไป → เข้ามา
- RuleList ที่มี Rule เดียวก็แสดงเป็นตาราง `# | A | B` เหมือนที่มีหลาย Rule
- Network Devices (`NadClients`) และ Network Device Groups (`NadGroups`) มีชื่อหมวดเหมือนใน ClearPass แทนชื่อ tag ใน XML
- Device Group แสดง `name` และ `description` ก่อน `membersFormat` / `members` เหมือนฟอร์มใน ClearPass (profile กำหนดได้ผ่าน `leadAttrs` field อื่นยังเรียงตาม XML)

### ความลับ
- SNMP `communityString` (และ field ชื่อ `community`) ถูกซ่อนเป็น `••••••` เหมือนรหัสผ่าน ทั้งในหน้าความแตกต่างและ Raw XML

## 1.0.0 — 2026-11-05

เวอร์ชันแรกที่ออกเป็นแอป desktop

### หน้าความแตกต่าง
- หน้า Overview จัดเป็นหมวด → Changed / Only in B / Only in A → การ์ดละ object พร้อมค่า `เดิม → ใหม่` ในบรรทัดเดียว กล่องตัวเลขด้านบนกดเป็นตัวกรองได้
- ตาราง `Field | A | B` และ `# | A | B` แบบเดียวกันทุกที่ (ดูมาตรฐานใน README หัวข้อ "อ่านหน้าความแตกต่าง")
- Auth Source: ค่า NVPair (timeout, server, port, …) รวมเป็นตาราง A | B ตารางเดียว
- Auth Method / Auth Source / Authorization Source ใน service: ตาราง A | B แถวละรายการ
- เงื่อนไข ผลลัพธ์ และ attribute ของ profile แสดงเป็น field (type / name / operator / value)
- RuleList แสดงแถวละ Rule สรุปเป็น `IF … THEN Role = …` กดแถวเพื่อดู Rule ทั้งข้อ (เงื่อนไข + ผลลัพธ์ ไม่ซ่อนส่วนที่ไม่เปลี่ยน)
- Rule ที่สลับลำดับแสดงตามตำแหน่งจริงของแต่ละไฟล์ (ไขว้กัน) และทำสีเหลือง
- เงื่อนไขแสดงที่มาของค่า เช่น `Authorization:PLUEM-ZNC-AD:memberOf`, `Endpoint:Zone`
- เงื่อนไขของ Rule ใช้ชื่อ "Rule Condition (MATCHES_ALL)" เหมือน "Service Rule (MATCHES_ALL)" ของ service
- element ห่อที่ไม่มีชื่อเป็นหัวข้อเล็ก ไม่ซ้อนเป็นกล่อง
- field เรียงตามลำดับใน XML เสมอ
- หัวหมวดใหญ่ใช้ไอคอนโฟลเดอร์สีน้ำเงิน แยกจากสีสถานะ; ไม่มีแถบสีด้านซ้ายของกล่อง
- ค่า secret ที่ฝังอยู่ในชื่อรายการถูก mask ด้วย (sidebar, Overview, รายละเอียด)

### การนับและ engine
- ตัวเลข `+ − ~` ทุกที่นับแบบเดียวกัน: จุดที่เปลี่ยนทุกชั้นข้างใน แถวแม่ = ผลรวมแถวลูก, แถว Only in A/B แสดง `−1`/`+1`
- แก้หลาย field ใน element เดียว (เช่น `value` + `displayValue`) นับเป็น 1
- Rule ที่แค่ย้ายตำแหน่งตรวจเป็น "Moved" แทนลบแล้วเพิ่ม
- engine เก็บชื่อฝั่ง A (`labelA`) เมื่อต่างจากฝั่ง B

### แอป
- `npm run dev` / `pnpm dev` เปิดแอป desktop (Tauri); โหมดเว็บย้ายไป `pnpm web:dev`
- เลขเวอร์ชันเก็บที่ `package.json` ที่ root ที่เดียว (หน้าแอปและตัวติดตั้งอ่านจากที่นี่)
- หน้า About: เวอร์ชัน, copyright, ข้อความ MIT License ฉบับเต็ม, ปุ่ม Check for updates
- เช็กอัปเดตอัตโนมัติจาก GitHub Releases (Tauri updater, ไฟล์อัปเดตต้องมีลายเซ็น) พร้อมกล่องแจ้งเตือน "Update & restart"
- GitHub Actions `release.yml`: push tag `v*` → build macOS + Windows → draft release พร้อม `latest.json`
- MIT License
