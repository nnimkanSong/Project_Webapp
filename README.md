🔧 วิธีติดตั้งโปรเจกต์
หากคุณต้องการ clone โปรเจกต์นี้ พร้อมกับไฟล์ในโฟลเดอร์ client/ กรุณาทำตามขั้นตอนด้านล่าง:

bash
คัดลอก
แก้ไข
git clone https://github.com/nnimkanSong/Project_Webapp.git
cd Project_Webapp
git submodule update --init --recursive
คำสั่ง git submodule update --init --recursive จะช่วยดาวน์โหลดซับโมดูลทั้งหมดที่เชื่อมโยงไว้กับโปรเจกต์นี้ (เช่น โฟลเดอร์ client)

