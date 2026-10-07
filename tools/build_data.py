"""Build a browsable dataset from the reviewed exam analysis and original PDFs.

Usage: python -X utf8 tools/build_data.py --source ../分析工作 --originals ..
Optional local PDF libraries: --deps ../分析工作/依赖
"""
import argparse
import json
import re
import shutil
from pathlib import Path
import sys

parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, required=True)
parser.add_argument('--originals', type=Path, required=True)
parser.add_argument('--deps', type=Path)
args = parser.parse_args()
if args.deps:
    sys.path.insert(0, str(args.deps.resolve()))
import pymupdf as fitz
from PIL import Image

root = Path(__file__).resolve().parents[1]
data = json.loads((args.source / '考频数据.json').read_text(encoding='utf-8'))
modules = json.loads((args.source / '模块概要.json').read_text(encoding='utf-8'))
sources = {name: chr(97 + i) for i, name in enumerate(sorted({x['source'] for x in data['coverage']}))}

titles = {
 2021: {
 '一': ['流型与平均 / 最大流速', '层流阻力随流速和管径的变化', '离心泵的主要参数', '关小出口阀后的仪表读数', '蒸汽加热空气的壁温与总传热系数', '由操作线求回流比与产品组成', '蒸馏依据与精馏必要条件', '亨利定律与相平衡常数', '难溶气体吸收的控制阻力', '升温后的湿空气状态', '干燥可除去与不可除去的水分'],
 '二': ['恒摩尔流假设的条件与作用', '板式塔与填料塔的气液接触', '泵的工作原理与出口阀调节', '羽绒与棉衣的保温效果'],
 '三': ['管路输送：泵选型与安装高度', '套管换热器：冷却水量与传热计算', '恒压过滤：增压、时间与洗涤', '氨吸收：填料层高度与溶剂量', '连续精馏：衡算、回流比与逐板计算']},
 2022: {
 '一': ['两截面间的流动方向', '因次分析的目的', '层流时涂蜡对阻力的影响', '启动后不出水与高真空度', '正位移泵的辨别', '延长恒压过滤的新增滤液量', '沉降阶段与水温影响', '沸腾传热强化', '增加冷流体流量后的出口温度与热负荷', '增大管径能否提高空气出口温度', '斯蒂芬–玻尔兹曼定律', '传质单元数与高度的物理意义', '由气液膜系数判断控制阻力', '传质单元数与理论板数的比较', '溶剂与气体浓度变化对吸收率的影响', '加料板下移后的产品组成', '回流比与产品浓度的极限', '多级错流萃取的特点'],
 '二': ['毕托管偏离中心后的压差计读数', '颗粒密度与降尘室高度的影响', '进气浓度变化：吸收率与操作线', '减小回流比：组成、能耗与塔板操作'],
 '三': ['离心泵：工作点与变速调节', '板框过滤：面积、滤框与最大生产能力', '换热器校核：出口温度与单双管程', '填料吸收：塔高与降低塔高后的回收率', '苯–甲苯精馏：衡算、操作线与板效率']},
 2023: {
 '一': ['旋风分离器的临界粒径', '并联管路的特点', '自然对流与强制对流', '开大离心泵出口阀', '圆筒壁径向热通量', '变径管路中的雷诺数', '板框过滤：常数与辅助时间', '有毒物质的换热器流程选择', '层流速度分布与摩擦系数', '气体流量对降尘室与旋风效率的影响', '对流传热系数的准数', '海拔与泵允许安装高度', '保温层的临界直径', '浮阀塔板溢流堰的作用', '苯–甲苯相平衡与相对挥发度', '单向扩散的通量与总体流动', '精馏压力对板数与热负荷的影响', '亨利系数与气膜 / 液膜控制', '筛孔、浮阀与泡罩塔板的性能', '增大气体流率后的吸收操作'],
 '二': ['离心泵振动、噪声与汽蚀措施', '导热系数与保温层厚度的判断', '过滤推动力、阻力与当量滤饼厚度', '双膜理论模型的内容与意义', '精馏原理与必要条件'],
 '三': ['离心泵：阀门阻力与有效 / 轴功率', '换热器：膜系数、污垢热阻与蒸汽温度', '精馏：最小回流比与第二块板组成', '吸收：实际 / 最小液气比与传质单元高度']},
 2024: {
 '一': ['升温后的雷诺数', '转子流量计的阻力损失', '低位槽液面变化后的泵工作点', '季节变化与泵的汽蚀', '自然对流的形成原因', '降尘室高度与生产能力', '气相与液相扩散系数', '全回流下相邻理论板组成', '吸收压力与最大吸收率', '萃取：分配系数与选择性系数', '亨利系数、溶解度与温度', 'q线与进料热状态变化'],
 '二': ['蒸馏方式与第三组分', '静止流体中的传质与扩散', '题干残缺，知识点暂未判定', '并流 / 逆流与所需传热面积', '传热速率下降的可能原因'],
 '三': ['换热器流程选择与强化控制侧', '塔板液泛与异常水力学现象'],
 '四': ['泵选型与实际输送流量', '换热器：面积设计与管径变化', '板框过滤：过滤常数与生产能力', '填料吸收：溶剂量与总体积传质系数', '精馏：产品回收率、回流比与操作线']},
 2025: {
 '一': ['对流传热系数的比较', '换热器结垢后的出口温度', '双层圆筒壁热通量的比较', '温度对旋风分离效率的影响'],
 '二': ['垂直等径管中的动能与静压能', '阻力平方区：加倍流量后的阻力', '分子扩散的定义', '板式塔严重漏液的原因', '进料组成降低后的精馏产品组成', '填料、再沸器与冷凝器的理论板数', '增大填料层高度后的传质与吸收率', '温度、压力与氨吸收平衡'],
 '三': ['平衡蒸馏、简单蒸馏与精馏比较', '汽蚀改善措施及其原理', '萃取剂选择性与用量的影响'],
 '四': ['管路与离心泵综合计算'], '五': ['过滤：生产能力、增压与回转真空过滤机'],
 '六': ['非纯溶剂吸收：组成、塔高与回收率'], '七': ['精馏：操作线反推与最小回流比推导'],
 '八': ['换热器：总传热系数、校核与蒸汽温度']}
}
topic_by_code = {t['code']: t for t in data['topics']}
for q in data['questions']:
    q.pop('path', None)
    q.pop('topic_codes', None)
    q['title'] = topic_by_code.get(q['primary'], {}).get('name', '知识点待判定')
    if q['year'] in titles and q['section'] in titles[q['year']]:
        entries = titles[q['year']][q['section']]
        q['title'] = entries[int(q['q']) - 1 if q['q'].isdigit() else 0]
    if q['id'] == '2022-三-04':
        q['pages'] = [13]
    q['pageImages'] = [f"assets/pages/{sources[q['source']]}-{n:03}.webp" for n in q['pages']]

guides = [
 {'module':'管路与泵', 'method':'先选截面和压力基准，再把连续性、伯努利与阻力关系联立，最后与泵特性曲线求工作点。练习阀门调节、变速、扬程与功率；能解释仪表读数变化。', 'pitfalls':'表压与绝压；管子内外径；摩擦系数定义；泵曲线中流量单位；吸入侧与出口侧调节；气缚与汽蚀。', 'concept':'汽蚀要能说明发生条件、安装高度、温度与吸入阻力的影响及改善措施。', 'examples':['2023-三-01','2025-四','2025-三-02']},
 {'module':'传热与换热器', 'method':'热衡算 → 膜系数与热阻 → 总传热系数 → 平均温差 → 面积或出口温度。设计、设备校核和工况改变都要练；导热与保温另作短题准备。', 'pitfalls':'K的面积基准；污垢与管壁热阻；热流率Q与热通量q；改变管径后流速与膜系数也改变；冷凝蒸汽温度。', 'concept':'能解释管壳程选择、控制热阻侧强化，以及平壁与圆筒壁导热的区别。', 'examples':['2022-三-03','2023-三-02','2025-八']},
 {'module':'精馏与蒸馏', 'method':'全塔衡算 → 两段操作线与q线 → 相平衡逐板计算。练习由操作线反推产品组成与回流比，掌握最小回流比的适用条件与图解推导。', 'pitfalls':'相邻板的气液组成；平衡关系与操作线混用；q线特殊情况；回收率与产品浓度；再沸器和分凝器计板。', 'concept':'结合固定的设计或运行条件，分析压力、进料位置、热状态、回流比与进料组成变化。', 'examples':['2022-三-05','2023-三-03','2025-七']},
 {'module':'吸收', 'method':'统一y/x与Y/X基准，依次列衡算、操作线、最小液气比、实际溶剂量与塔高。练习纯溶剂和循环溶剂、传质单元以及塔高变化。', 'pitfalls':'摩尔分数与摩尔比；惰性气流量与混合气流量；最小液气比端点；HOG与NOG；入塔溶剂中的溶质。', 'concept':'双膜理论要能写假设与阻力关系；结合亨利系数判断控制膜；操作分析用平衡线和操作线说明。', 'examples':['2022-三-04','2023-三-04','2025-六','2023-二-04']},
 {'module':'过滤', 'method':'恒压过滤方程 → 过滤常数与压力 / 时间 / 面积变化 → 洗涤与辅助时间 → 周期生产能力。练习板框与回转真空过滤机的转换。', 'pitfalls':'过滤面积的双面计算；洗涤速率与过滤终了速率；周期生产能力与瞬时速率；辅助时间；滤饼可压缩性。', 'concept':'能说明推动力、介质和滤饼阻力、当量滤饼厚度及最大生产能力。2023年没有独立计算大题，仍有填空与简答。', 'examples':['2022-三-02','2024-四-03','2025-五','2023-二-03']}
]

for c in data['coverage']:
    c['pageImages'] = [f"assets/pages/{sources[c['source']]}-{n:03}.webp" for n in c['pages']] if c['included'] else []
data['modules'] = [{k:v for k,v in m.items() if k!='topics'} for m in modules]
data['guides'] = guides
data['meta'] = {
 'updated':'2026-10-07', 'target':'2026年12月初试 · 2027年招生',
 'school':'中国石油大学（北京）', 'subject':'830 化工原理',
 'syllabusDate':'2026-09-28',
 'syllabusUrl':'https://www.cup.edu.cn/chem/yjsjy/zsxx/5a902f3edc204a848af26709529a55af.htm',
 'syllabusDownload':'https://www.cup.edu.cn/chem/docs//2026-09/652365a5c02d4ea48c1559f61c474730.docx',
 'repository':'https://github.com/Linjia12138/cup830-review'
}

pages_by_source = {}
for c in data['coverage']:
    if c['included']:
        pages_by_source.setdefault(c['source'],set()).update(c['pages'])
for name, page_nums in pages_by_source.items():
    with fitz.open(args.originals / name) as doc:
        for page_num in sorted(page_nums):
            target = root / f'assets/pages/{sources[name]}-{page_num:03}.webp'
            if target.exists():
                continue
            page = doc[page_num-1]
            pix = page.get_pixmap(matrix=fitz.Matrix(2000/page.rect.width, 2000/page.rect.width), alpha=False)
            Image.frombytes('RGB', (pix.width,pix.height),pix.samples).save(target, 'WEBP',quality=90)
    print(name, len(page_nums), 'pages', flush=True)

(root/'assets/data.js').write_text('window.EXAM_DB = '+json.dumps(data, ensure_ascii=False, separators=(',',':'))+';\n',encoding='utf-8')
reports = args.originals / '复习分析'
shutil.copy2(reports/'830化工原理考频与复习重点.xlsx',root/'downloads/830-review.xlsx')
shutil.copy2(reports/'830化工原理考频与复习重点解读.md',root/'downloads/830-review.md')
print('Dataset:',len(data['questions']),'questions;',len(data['topics']),'topics;',sum(map(len,pages_by_source.values())),'scan pages')
