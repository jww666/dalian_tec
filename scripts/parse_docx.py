import json
import re
import sys
import zipfile
from html import unescape
from pathlib import Path
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
OUT_JSON = ROOT / "data" / "tutors.json"
OUT_JS = ROOT / "data" / "tutors.js"

SUBJECTS = [
    "语文",
    "数学",
    "英语",
    "物理",
    "化学",
    "生物",
    "政治",
    "历史",
    "地理",
    "科学",
    "奥数",
    "编程",
    "钢琴",
    "美术",
    "音乐",
    "书法",
    "全科",
    "作业辅导",
]

SUBJECT_ALIASES = {
    "语数外": ["语文", "数学", "英语"],
    "数理化": ["数学", "物理", "化学"],
    "理科": ["数学", "物理", "化学"],
}

DISTRICTS = [
    "中山区",
    "西岗区",
    "沙河口区",
    "甘井子区",
    "旅顺口区",
    "金州区",
    "普兰店区",
    "瓦房店市",
    "庄河市",
    "长海县",
    "高新区",
    "开发区",
]

DISTRICT_ALIASES = {
    "中山": "中山区",
    "西岗": "西岗区",
    "沙河口": "沙河口区",
    "甘井子": "甘井子区",
    "旅顺": "旅顺口区",
    "金州": "金州区",
    "普兰店": "普兰店区",
    "瓦房店": "瓦房店市",
    "庄河": "庄河市",
    "长海": "长海县",
    "高新": "高新区",
    "开发区": "开发区",
}


def read_docx_text(path: Path) -> str:
    if not path.exists():
        raise FileNotFoundError(f"找不到文件：{path}")
    if path.stat().st_size == 0:
        return ""

    with zipfile.ZipFile(path) as zf:
        xml = zf.read("word/document.xml")

    root = ET.fromstring(xml)
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    paragraphs = []
    for para in root.findall(".//w:p", ns):
        parts = []
        for node in para.findall(".//w:t", ns):
            if node.text:
                parts.append(node.text)
        text = unescape("".join(parts)).strip()
        if text:
            paragraphs.append(text)
    return "\n".join(paragraphs)


def split_blocks(text: str) -> list[str]:
    lines = [line.strip() for line in text.replace("\u3000", " ").splitlines()]
    lines = [line for line in lines if line]
    if not lines:
        return []

    blocks = []
    current = []
    serial_start = re.compile(
        r"^(?:(?:序号|编号|单号|需求)\s*[:：]?\s*)?[A-Za-z]?\d{3,5}(?:-\d{1,3})?(?:[（(][^）)]{0,20}[）)])?\s*(?:[:：、.)-])?"
    )
    label_start = re.compile(r"^(?:地址|地点|位置|薪资|工资|年级|科目|要求|备注)[:：]")

    for line in lines:
        starts_new = (bool(serial_start.search(line)) or line.startswith("帮出")) and current
        if starts_new:
            blocks.append("\n".join(current))
            current = [line]
        else:
            current.append(line)

    if current:
        blocks.append("\n".join(current))

    cleaned = []
    for block in blocks:
        if re.search(r"(辅导年级|学员年级|年级|补习科目|学科|详细地址|位置|薪资)", block):
            cleaned.append(block)
    return cleaned


def first_match(patterns: list[str], text: str) -> str:
    for pattern in patterns:
        match = re.search(pattern, text, re.I)
        if match:
            return match.group(1).strip(" ：:，,。；;\n\t")
    return ""


def extract_serial(block: str, fallback: int) -> str:
    value = first_match(
        [
            r"(?:序号|编号|单号|需求)\s*[:：]?\s*([A-Za-z]?\d{3,5}(?:-\d{1,3})?)",
            r"^\s*([A-Za-z]?\d{3,5}(?:-\d{1,3})?)",
        ],
        block,
    )
    return value or f"T{fallback:03d}"


def extract_salary(block: str) -> tuple[str, int | None, int | None]:
    salary = first_match(
        [
            r"(?:薪资|工资|报酬|课酬|价格)\s*[:：]?\s*([^\n，,。；;]+)",
            r"((?:\d{2,4}\s*[-~—到至]\s*)?\d{2,4}\s*(?:元|块)\s*(?:/|每)?\s*(?:小时|h|H|课时|次|天|月)?)",
            r"((?:\d{2,4}\s*[-~—到至]\s*)?\d{2,4}\s*(?:/|每)\s*(?:小时|h|H|课时|次|天|月))",
        ],
        block,
    )
    nums = [int(x) for x in re.findall(r"\d{2,5}", salary)]
    if not nums:
        nums = [int(x) for x in re.findall(r"\d{2,5}", block[:80])]
    if not nums:
        return salary, None, None
    if len(nums) == 1:
        return salary, nums[0], nums[0]
    return salary, min(nums[:2]), max(nums[:2])


def extract_grade(block: str) -> str:
    course_line = first_match(
        [
            r"(?:辅导年级及科目|辅导年级|学员年级|年级)\s*[:：]?\s*([^\n，,。；;()（）]{1,24})",
            r"((?:小学|初中|高中|幼儿园|大学)?[一二三四五六七八九十\d]+年级)",
            r"((?:小|初|高)[一二三四五六七八九\d])",
        ],
        block,
    )
    grade = first_match(
        [
            r"((?:小学|初中|高中|幼儿园|大学)?[一二三四五六七八九十\d]+年级)",
            r"((?:小|初|高)[一二三四五六七八九\d])",
            r"((?:小学|初中|高中|幼儿园|大学))",
        ],
        course_line or block,
    )
    return grade or course_line


def extract_subjects(block: str) -> list[str]:
    found = []
    for key, values in SUBJECT_ALIASES.items():
        if key in block:
            found.extend(values)
    for subject in SUBJECTS:
        if subject in block:
            found.append(subject)
    subject_line = first_match([r"(?:补习科目|学科)\s*[:：]?\s*([^\n，,。；;]{1,18})"], block)
    for subject in SUBJECTS:
        if subject_line and subject in subject_line:
            found.append(subject)
    if "全科" not in found and ("陪读" in block or "托管" in block):
        found.append("作业辅导")
    return unique_ordered(found) or ["未注明"]


def unique_ordered(values: list[str]) -> list[str]:
    result = []
    for value in values:
        if value not in result:
            result.append(value)
    return result


def extract_district(block: str) -> str:
    for district in DISTRICTS:
        if district in block:
            return district
    for key, value in DISTRICT_ALIASES.items():
        if key in block:
            return value
    return "未注明"


def extract_address(block: str, district: str) -> str:
    address = first_match(
        [
            r"(?:详细地址|地址|地点|位置|区域|住址|上课地点)\s*[，,:：]?\s*([^\n。；;]{2,60})",
            r"((?:中山区|西岗区|沙河口区|甘井子区|旅顺口区|金州区|普兰店区|高新区|开发区)[^\n。；;]{0,45})",
        ],
        block,
    )
    if address:
        return address
    return district if district != "未注明" else "大连市"


def compact_note(block: str, fields: list[str]) -> str:
    note = block
    for field in fields:
        if field:
            note = note.replace(field, " ")
    note = re.sub(r"\s+", " ", note).strip()
    return note[:240]


def parse(text: str) -> list[dict]:
    tasks = []
    for index, block in enumerate(split_blocks(text), start=1):
        serial = extract_serial(block, index)
        salary, salary_min, salary_max = extract_salary(block)
        grade = extract_grade(block) or "未注明"
        subjects = extract_subjects(block)
        district = extract_district(block)
        address = extract_address(block, district)
        note = compact_note(block, [serial, salary, grade, address, district, *subjects])
        tasks.append(
            {
                "id": serial,
                "address": address,
                "district": district,
                "salary": salary or "未注明",
                "salaryMin": salary_min,
                "salaryMax": salary_max,
                "grade": grade,
                "subjects": subjects,
                "note": note or block[:240],
                "raw": block,
                "lat": None,
                "lng": None,
            }
        )
    return tasks


def write_data(tasks: list[dict]) -> None:
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(tasks, ensure_ascii=False, indent=2)
    OUT_JSON.write_text(payload + "\n", encoding="utf-8")
    OUT_JS.write_text("window.TUTOR_DATA = " + payload + ";\n", encoding="utf-8")


def main() -> int:
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r"D:\大连家教.docx")
    text = read_docx_text(source)
    tasks = parse(text)
    write_data(tasks)
    print(f"读取：{source}")
    print(f"提取：{len(tasks)} 条家教需求")
    print(f"写入：{OUT_JSON}")
    print(f"写入：{OUT_JS}")
    if not text:
        print("提醒：Word 文件为空或未保存内容，当前生成的是空数据。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
