-- Seed: FICTIONAL demonstration data only.
-- No real client, site, room, or equipment information. Invented for an academic demo.

with s1 as (
  insert into site (code, name) values ('GX-TOWER', 'Globex HQ Tower') returning id
), s2 as (
  insert into site (code, name) values ('GX-RIVER', 'Globex Riverside Campus') returning id
), s3 as (
  insert into site (code, name) values ('GX-NORTH', 'Globex Northgate Office') returning id
),
r1 as (
  insert into room (site_id, name, room_type, floor, qr_token)
  select id, 'Summit Boardroom', 'BOARDROOM', '12F', 'gx-summit-boardroom' from s1 returning id
),
r2 as (
  insert into room (site_id, name, room_type, floor, qr_token)
  select id, 'Horizon Training Room', 'TRAINING_ROOM', '3F', 'gx-horizon-training' from s2 returning id
),
r3 as (
  insert into room (site_id, name, room_type, floor, qr_token)
  select id, 'Aspen Meeting Room', 'MEETING_ROOM', '5F', 'gx-aspen-meeting' from s3 returning id
)
insert into asset (room_id, brand, model, description, asset_tag)
select id, 'Vistra', 'VV-65UHD', '65" 4K display', 'GX-TWR-DISP-01' from r1
union all select id, 'Vistra', 'VV-65UHD', '65" 4K display', 'GX-TWR-DISP-02' from r1
union all select id, 'Acoustix', 'CV-200', 'All-in-one conferencing bar', 'GX-TWR-BAR-01' from r1
union all select id, 'OptiCam', 'PTZ-4K', 'PTZ conferencing camera', 'GX-TWR-CAM-01' from r1
union all select id, 'Acoustix', 'CM-360', 'Ceiling microphone', 'GX-TWR-MIC-01' from r1
union all select id, 'Acoustix', 'DSP-440', 'Audio processor', 'GX-TWR-DSP-01' from r1
union all select id, 'Vistra', 'VV-86UHD', '86" 4K display', 'GX-RIV-DISP-01' from r2
union all select id, 'Acoustix', 'AMP-120', '120W amplifier', 'GX-RIV-AMP-01' from r2
union all select id, 'Acoustix', 'SP-20', 'Ceiling speaker', 'GX-RIV-SPK-01' from r2
union all select id, 'ConnectPro', 'BYOD-10', 'Wireless content adapter', 'GX-RIV-BYOD-01' from r2
union all select id, 'Vistra', 'VV-55UHD', '55" 4K display', 'GX-NTH-DISP-01' from r3
union all select id, 'Acoustix', 'CV-100', 'Compact conferencing bar', 'GX-NTH-BAR-01' from r3;
