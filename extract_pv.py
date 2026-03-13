"""Extract product numbers from PV DE RECEPTION PDF with OCR correction"""
import pdfplumber, re

pdf = pdfplumber.open(r'PV DE RECEPTION BAP 9300_260313_202656.pdf')

# Get raw words with positions for both pages
all_words = []
for page in pdf.pages:
    words = page.extract_words(x_tolerance=2, y_tolerance=2, keep_blank_chars=False)
    for w in words:
        all_words.append({
            'page': page.page_number,
            'x': round(w['x0']),
            'y': round(w['top']),
            'text': w['text']
        })
pdf.close()

# --- Manual reconstruction from careful OCR reading ---
# Page 1 data (10 columns per row, 30 rows):
page1_raw = """
61  118  199  263  325  377  434  664  756  1787
62  119  201  264  326  378  435  676  757  1788
63  131  202  265  327  379  436  677  758  1789
64  132  243  266  328  380  437  678  759  1790
71  133  204  267  329  381  439  679  760  1791
72  134  245  268  330  382  441  696  761  1792
73  136  206  269  331  383  442  697  762  1793
74  138  207  270  332  384  443  698  763  1794
76  140  208  271  333  385  444  699  764  1795
77  141  209  272  334  386  445  700  765  1796
78  142  210  273  335  387  458  711  766  1797
79  143  211  274  336  388  466  712  767  1798
80  144  212  275  337  389  469  713  768  1799
81  145  213  276  338  390  478  714  769  1800
82  147  214  277  339  410  479  715  770  1801
83  148  215  278  344  411  562  716  774  1804
84  149  216  279  356  412  563  717  793  1831
85  150  217  280  357  413  606  718  1581  1832
86  151  218  296  358  414  607  719  1702  1833
87  152  219  297  359  421  608  720  1703  1834
88  153  220  298  366  422  609  721  1765  1846
89  154  236  299  367  424  610  722  1766  1847
90  155  237  300  368  425  613  723  1767  1848
91  176  238  317  369  427  614  724  1768  1849
92  177  256  318  371  428  615  725  1781  1852
93  178  257  319  372  429  617  739  1782  1853
94  179  258  320  373  430  618  751  1783  1854
95  196  259  322  374  431  661  752  1784  1855
116  197  261  323  375  432  662  753  1785  1856
117  198  262  324  376  433  663  754  1786  1857
"""

# Page 2 data (5 columns per row, 30 rows):
page2_raw = """
1858  2058  2138  2203  2256
1859  2059  2139  2204  2257
1860  2072  2140  2205  2258
1861  2073  2142  2206  2259
1862  2074  2143  2207  2260
1863  2076  2144  2208  2261
1864  2077  2145  2209  2263
1865  2078  2147  2210  2264
1866  2079  2148  2211  2265
1867  2080  2149  2212  2289
1868  2081  2150  2214  2303
1869  2082  2152  2215  2304
1870  2083  2153  2236  2305
1900  2084  2154  2237  2306
1901  2085  2155  2238  2308
1902  2086  2176  2239  2309
1903  2087  2177  2241  2310
1910  2088  2178  2242  2313
1911  2089  2179  2243  2314
1913  2091  2191  2244  2315
1914  2092  2192  2246
1916  2094  2194  2247
1917  2095  2195  2248
1918  2098  2196  2249
1927  2116  2197  2250
1930  2117  2198  2251
1965  2131  2199  2252
1975  2132  2200  2253
2056  2136  2201  2254
2057  2137  2202  2255
"""

# Parse numbers from raw text
nums = set()
for line in (page1_raw + page2_raw).strip().split('\n'):
    line = line.strip()
    if not line:
        continue
    for token in line.split():
        if token.isdigit():
            nums.add(int(token))

nums = sorted(nums)
print(f"Total unique product numbers: {len(nums)}")
print(f"Expected: 436")
print()

# Print in rows of 10
for i in range(0, len(nums), 10):
    chunk = nums[i:i+10]
    print("  ".join(str(n) for n in chunk))

# Write to a JSON file for use by the import script
import json
with open('pv_product_numbers.json', 'w') as f:
    json.dump(nums, f)
print(f"\nSaved to pv_product_numbers.json")
