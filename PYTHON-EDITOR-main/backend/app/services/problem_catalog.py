from __future__ import annotations

import json
import logging
import random
import string
from dataclasses import dataclass
from typing import Any, Callable
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy.orm import Session

from app.models.problem import Problem, TestCase


VISIBLE_CASE_COUNT = 3
HIDDEN_CASE_COUNT = 3
logger = logging.getLogger(__name__)
THEMES = [
    "Beacon",
    "Orbit",
    "Quartz",
    "Nimbus",
    "Atlas",
    "Aurora",
    "Cipher",
    "Delta",
    "Ember",
    "Flux",
]


@dataclass(frozen=True)
class TestCaseSeed:
    input: str
    expected_output: str
    is_hidden: bool
    sort_order: int


@dataclass(frozen=True)
class ProblemSeed:
    id: str
    title: str
    slug: str
    difficulty: str
    description: str
    input_format: str
    output_format: str
    constraints_text: str
    starter_code: str
    function_name: str
    tags: list[str]
    test_cases: list[TestCaseSeed]


@dataclass(frozen=True)
class SeedSummary:
    total_count: int
    inserted_count: int
    skipped_count: int
    forced: bool


@dataclass(frozen=True)
class TemplateDefinition:
    slug_prefix: str
    title_suffix: str
    difficulty: str
    tags: list[str]
    build_description: Callable[[int], str]
    build_input_format: Callable[[int], str]
    build_output_format: Callable[[int], str]
    build_constraints: Callable[[int], list[str]]
    build_starter_code: Callable[[int], str]
    build_test_cases: Callable[[int], list[TestCaseSeed]]


def build_problem_catalog() -> list[ProblemSeed]:
    catalog: list[ProblemSeed] = []
    for template in _templates():
        for variation_index, theme in enumerate(THEMES):
            slug = f"{template.slug_prefix}-{variation_index + 1:02d}"
            title = f"{theme} {template.title_suffix}"
            catalog.append(
                ProblemSeed(
                    id=str(uuid5(NAMESPACE_URL, f"https://pyzone.uz/problems/{slug}")),
                    title=title,
                    slug=slug,
                    difficulty=template.difficulty,
                    description=template.build_description(variation_index),
                    input_format=template.build_input_format(variation_index),
                    output_format=template.build_output_format(variation_index),
                    constraints_text="\n".join(template.build_constraints(variation_index)),
                    starter_code=template.build_starter_code(variation_index),
                    function_name="solve",
                    tags=list(template.tags),
                    test_cases=template.build_test_cases(variation_index),
                )
            )
    return catalog


def ensure_problem_catalog_seeded(db: Session) -> SeedSummary:
    total_count = len(build_problem_catalog())
    existing_count = db.query(Problem).count()

    if existing_count >= total_count:
        logger.info("%s problems ready.", total_count)
        return SeedSummary(
            total_count=total_count,
            inserted_count=0,
            skipped_count=total_count,
            forced=False,
        )

    logger.info("Seeding problems...")
    summary = seed_problem_catalog(db, force=False)
    logger.info("%s problems ready.", summary.total_count)
    return summary


def seed_problem_catalog(db: Session, *, force: bool = False) -> SeedSummary:
    catalog = build_problem_catalog()

    if force:
        db.query(TestCase).delete()
        db.query(Problem).delete()
        db.commit()

    existing_slugs = {slug for (slug,) in db.query(Problem.slug).all()}
    inserted_count = 0
    skipped_count = 0

    for problem_seed in catalog:
        if problem_seed.slug in existing_slugs:
            skipped_count += 1
            continue

        problem = Problem(
            id=problem_seed.id,
            title=problem_seed.title,
            slug=problem_seed.slug,
            difficulty=problem_seed.difficulty,
            description=problem_seed.description,
            input_format=problem_seed.input_format,
            output_format=problem_seed.output_format,
            constraints_text=problem_seed.constraints_text,
            starter_code=problem_seed.starter_code,
            function_name=problem_seed.function_name,
            tags_json=json.dumps(problem_seed.tags, ensure_ascii=False),
        )
        db.add(problem)
        db.flush()

        for test_case in problem_seed.test_cases:
            db.add(
                TestCase(
                    problem_id=problem.id,
                    input=test_case.input,
                    expected_output=test_case.expected_output,
                    is_hidden=test_case.is_hidden,
                    sort_order=test_case.sort_order,
                )
            )

        inserted_count += 1

    db.commit()
    return SeedSummary(
        total_count=len(catalog),
        inserted_count=inserted_count,
        skipped_count=skipped_count,
        forced=force,
    )


def _serialize_value(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def _serialize_args(*args: Any) -> str:
    return "\n".join(_serialize_value(arg) for arg in args)


def _starter(signature: str) -> str:
    return "class Solution:\n" f"    def solve(self, {signature}):\n" "        pass\n"


def _problem_description(
    *,
    title: str,
    summary: str,
    steps: list[str],
    examples: list[str],
    notes: list[str],
) -> str:
    lines = [f"## {title}", "", summary, "", "### What to do", ""]
    lines.extend(f"- {step}" for step in steps)
    lines.extend(["", "### Examples", ""])
    lines.extend(examples)
    lines.extend(["", "### Notes", ""])
    lines.extend(f"- {note}" for note in notes)
    return "\n".join(lines)


def _mk_cases(
    solver: Callable[..., Any],
    argument_builder: Callable[[random.Random, int], tuple[Any, ...]],
    *,
    seed_prefix: int,
) -> list[TestCaseSeed]:
    cases: list[TestCaseSeed] = []
    for index in range(VISIBLE_CASE_COUNT + HIDDEN_CASE_COUNT):
        rng = random.Random(seed_prefix * 100 + index)
        args = argument_builder(rng, index)
        cases.append(
            TestCaseSeed(
                input=_serialize_args(*args),
                expected_output=_serialize_value(solver(*args)),
                is_hidden=index >= VISIBLE_CASE_COUNT,
                sort_order=index,
            )
        )
    return cases


def _divisible_sum_solver(nums: list[int], divisor: int) -> int:
    return sum(value for value in nums if value % divisor == 0)


def _char_count_solver(text: str, target_chars: str) -> int:
    allowed = set(target_chars.lower())
    return sum(1 for char in text.lower() if char in allowed)


def _distinct_sort_solver(nums: list[int], descending: bool) -> list[int]:
    return sorted(set(nums), reverse=descending)


def _balanced_brackets_solver(text: str) -> bool:
    pairs = {")": "(", "]": "[", "}": "{"}
    openings = set(pairs.values())
    stack: list[str] = []
    for char in text:
        if char in openings:
            stack.append(char)
        elif char in pairs:
            if not stack or stack.pop() != pairs[char]:
                return False
    return not stack


def _clean_palindrome_solver(text: str, letters_only: bool) -> bool:
    cleaned = "".join(char.lower() for char in text if char.isalpha() or (not letters_only and char.isdigit()))
    return cleaned == cleaned[::-1]


def _pair_sum_solver(nums: list[int], target: int) -> list[int]:
    lookup: dict[int, int] = {}
    for index, value in enumerate(nums):
        needed = target - value
        if needed in lookup:
            return [lookup[needed], index]
        if value not in lookup:
            lookup[value] = index
    return [-1, -1]


def _lower_bound_solver(nums: list[int], target: int) -> int:
    left = 0
    right = len(nums)
    while left < right:
        middle = (left + right) // 2
        if nums[middle] < target:
            left = middle + 1
        else:
            right = middle
    return left


def _frequency_leader_solver(nums: list[int]) -> int:
    counts: dict[int, int] = {}
    for value in nums:
        counts[value] = counts.get(value, 0) + 1
    return min(counts, key=lambda value: (-counts[value], value))


def _climb_ways_solver(n: int, max_step: int) -> int:
    dp = [0] * (max(1, n) + 1)
    dp[0] = 1
    for step in range(1, n + 1):
        dp[step] = sum(dp[step - jump] for jump in range(1, max_step + 1) if step - jump >= 0)
    return dp[n]


def _longest_unique_solver(text: str) -> int:
    seen: dict[str, int] = {}
    left = 0
    best = 0
    for right, char in enumerate(text):
        if char in seen and seen[char] >= left:
            left = seen[char] + 1
        seen[char] = right
        best = max(best, right - left + 1)
    return best


def _edit_distance_solver(left_text: str, right_text: str) -> int:
    rows = len(left_text) + 1
    cols = len(right_text) + 1
    dp = [[0] * cols for _ in range(rows)]
    for row in range(rows):
        dp[row][0] = row
    for col in range(cols):
        dp[0][col] = col
    for row in range(1, rows):
        for col in range(1, cols):
            if left_text[row - 1] == right_text[col - 1]:
                dp[row][col] = dp[row - 1][col - 1]
            else:
                dp[row][col] = 1 + min(dp[row - 1][col], dp[row][col - 1], dp[row - 1][col - 1])
    return dp[-1][-1]


def _trap_water_solver(heights: list[int]) -> int:
    left = 0
    right = len(heights) - 1
    left_max = 0
    right_max = 0
    total = 0
    while left < right:
        if heights[left] <= heights[right]:
            left_max = max(left_max, heights[left])
            total += left_max - heights[left]
            left += 1
        else:
            right_max = max(right_max, heights[right])
            total += right_max - heights[right]
            right -= 1
    return total


def _random_text(rng: random.Random, min_size: int, max_size: int, alphabet: str | None = None) -> str:
    source = alphabet or (string.ascii_lowercase + "     ")
    text = "".join(rng.choice(source) for _ in range(rng.randint(min_size, max_size)))
    return " ".join(text.split()) or "code"


def _random_bracket_text(rng: random.Random, length: int) -> str:
    return "".join(rng.choice("()[]{}abcxyz") for _ in range(length))


def _pair_sum_args(rng: random.Random, case_index: int) -> tuple[list[int], int]:
    if case_index == 0:
        return [2, 7, 11, 15], 9

    size = rng.randint(6, 10)
    nums = [rng.randint(-15, 25) for _ in range(size)]
    if case_index % 2 == 0:
        left = rng.randint(0, size - 2)
        right = rng.randint(left + 1, size - 1)
        target = nums[left] + nums[right]
    else:
        target = 1000 + case_index
    return nums, target


def _lower_bound_args(rng: random.Random, case_index: int) -> tuple[list[int], int]:
    if case_index == 0:
        return [1, 3, 3, 5], 3

    nums = sorted(rng.randint(-20, 30) for _ in range(rng.randint(6, 12)))
    target = rng.randint(-22, 32)
    return nums, target


def _edit_distance_args(rng: random.Random, case_index: int) -> tuple[str, str]:
    if case_index == 0:
        return "kitten", "sitting"
    if case_index == 1:
        return "arena", "arena"

    left_size = rng.randint(4, 8)
    right_size = rng.randint(4, 8)
    alphabet = "abcdeilmnoprstuvxyz"
    return (
        "".join(rng.choice(alphabet) for _ in range(left_size)),
        "".join(rng.choice(alphabet) for _ in range(right_size)),
    )


def _templates() -> list[TemplateDefinition]:
    char_sets = ["aeiou", "arena", "python", "logic", "queue", "stack", "delta", "orbit", "cipher", "flux"]

    return [
        TemplateDefinition(
            slug_prefix="divisible-sum",
            title_suffix="Divisible Sum",
            difficulty="easy",
            tags=["array", "math"],
            build_description=lambda index: _problem_description(
                title="Divisible Sum",
                summary=f"You are given an integer array. Return the sum of all values divisible by {index + 2}.",
                steps=[
                    "Inspect every number in the array.",
                    f"Keep the values divisible by {index + 2}.",
                    "Return their total sum as a single integer.",
                ],
                examples=[
                    f"- If nums = [3, 6, 7, 9] and the divisor is {index + 2}, only valid values should contribute to the answer.",
                    "- Empty matches should return 0.",
                ],
                notes=["Negative numbers may also be divisible.", "The array can contain duplicates."],
            ),
            build_input_format=lambda index: "nums: list[int]",
            build_output_format=lambda index: "Return one integer representing the filtered sum.",
            build_constraints=lambda index: [
                "1 <= len(nums) <= 200",
                "-1000 <= nums[i] <= 1000",
                f"The divisor for this problem is fixed to {index + 2}.",
            ],
            build_starter_code=lambda index: _starter("nums"),
            build_test_cases=lambda index: _mk_cases(
                lambda nums: _divisible_sum_solver(nums, index + 2),
                lambda rng, _: ([rng.randint(-40, 80) for _ in range(rng.randint(6, 10))],),
                seed_prefix=100 + index,
            ),
        ),
        TemplateDefinition(
            slug_prefix="pattern-char-count",
            title_suffix="Pattern Character Count",
            difficulty="easy",
            tags=["string", "hashmap"],
            build_description=lambda index: _problem_description(
                title="Pattern Character Count",
                summary=f'Count how many characters from the set "{char_sets[index]}" appear in the given text.',
                steps=[
                    "Treat uppercase and lowercase letters as the same.",
                    "Count each matching character occurrence.",
                    "Return the final count.",
                ],
                examples=[
                    '- In the text "Arena", the set "ae" would count three characters.',
                    "- Spaces and punctuation do not count unless they are part of the target set.",
                ],
                notes=["The target set is fixed for this problem.", "The input text may contain spaces."],
            ),
            build_input_format=lambda index: "text: str",
            build_output_format=lambda index: "Return one integer.",
            build_constraints=lambda index: [
                "1 <= len(text) <= 300",
                f'The target character set for this problem is "{char_sets[index]}".',
            ],
            build_starter_code=lambda index: _starter("text"),
            build_test_cases=lambda index: _mk_cases(
                lambda text: _char_count_solver(text, char_sets[index]),
                lambda rng, _: (_random_text(rng, 18, 42, string.ascii_letters + "     "),),
                seed_prefix=200 + index,
            ),
        ),
        TemplateDefinition(
            slug_prefix="distinct-sort",
            title_suffix="Distinct Sort",
            difficulty="easy",
            tags=["sorting", "array"],
            build_description=lambda index: _problem_description(
                title="Distinct Sort",
                summary="Remove duplicate integers from the array and return the remaining values in the required order.",
                steps=[
                    "Keep only one copy of each integer.",
                    "Sort the distinct values.",
                    f'Return them in {"descending" if index % 2 else "ascending"} order.',
                ],
                examples=[
                    "- [4, 1, 4, 2] becomes [1, 2, 4] in ascending mode.",
                    "- [4, 1, 4, 2] becomes [4, 2, 1] in descending mode.",
                ],
                notes=["The sort order is fixed for the whole problem statement.", "You must return a list."],
            ),
            build_input_format=lambda index: "nums: list[int]",
            build_output_format=lambda index: "Return a list[int] with unique sorted values.",
            build_constraints=lambda index: [
                "1 <= len(nums) <= 150",
                "-500 <= nums[i] <= 500",
                f'This variation uses {"descending" if index % 2 else "ascending"} order.',
            ],
            build_starter_code=lambda index: _starter("nums"),
            build_test_cases=lambda index: _mk_cases(
                lambda nums: _distinct_sort_solver(nums, bool(index % 2)),
                lambda rng, _: ([rng.randint(-20, 20) for _ in range(rng.randint(6, 12))],),
                seed_prefix=300 + index,
            ),
        ),
        TemplateDefinition(
            slug_prefix="balanced-brackets-lite",
            title_suffix="Balanced Brackets Lite",
            difficulty="easy",
            tags=["stack", "string"],
            build_description=lambda index: _problem_description(
                title="Balanced Brackets Lite",
                summary="Return true if every opening bracket is closed in the correct order.",
                steps=[
                    "Handle (), [] and {} characters.",
                    "Ignore any non-bracket characters.",
                    "Return a boolean answer.",
                ],
                examples=[
                    '- "()[]{}" is valid.',
                    '- "([)]" is not valid because the order is wrong.',
                ],
                notes=["Use a stack-like approach.", "An empty effective bracket sequence is valid."],
            ),
            build_input_format=lambda index: "text: str",
            build_output_format=lambda index: "Return true or false.",
            build_constraints=lambda index: [
                "1 <= len(text) <= 200",
                "Only bracket characters affect the verdict.",
            ],
            build_starter_code=lambda index: _starter("text"),
            build_test_cases=lambda index: _mk_cases(
                _balanced_brackets_solver,
                lambda rng, case_index: (
                    (
                        "()[]{}"
                        if case_index == 0
                        else "([{}])abc"
                        if case_index == 1
                        else _random_bracket_text(rng, rng.randint(8, 20))
                    ),
                ),
                seed_prefix=400 + index,
            ),
        ),
        TemplateDefinition(
            slug_prefix="clean-palindrome-check",
            title_suffix="Clean Palindrome Check",
            difficulty="easy",
            tags=["two-pointers", "string"],
            build_description=lambda index: _problem_description(
                title="Clean Palindrome Check",
                summary=(
                    "Normalize the text and decide whether it reads the same forward and backward. "
                    f'This variation keeps {"letters only" if index % 2 else "letters and digits"}.'
                ),
                steps=[
                    "Ignore spaces and punctuation.",
                    f'Keep {"letters only" if index % 2 else "letters and digits"} while normalizing.',
                    "Compare the cleaned string with its reverse.",
                ],
                examples=[
                    '- "Never odd or even" is a palindrome in normalized form.',
                    '- "Arena" is not a palindrome.',
                ],
                notes=["Case does not matter.", "Return a boolean answer."],
            ),
            build_input_format=lambda index: "text: str",
            build_output_format=lambda index: "Return true or false.",
            build_constraints=lambda index: [
                "1 <= len(text) <= 250",
                f'This variation keeps {"letters only" if index % 2 else "letters and digits"}.',
            ],
            build_starter_code=lambda index: _starter("text"),
            build_test_cases=lambda index: _mk_cases(
                lambda text: _clean_palindrome_solver(text, bool(index % 2)),
                lambda rng, case_index: (
                    (
                        "Never odd or even"
                        if case_index == 0
                        else "A man, a plan, a canal: Panama 202"
                        if case_index == 1
                        else _random_text(rng, 12, 30, string.ascii_letters + string.digits + " ,.:;!?")
                    ),
                ),
                seed_prefix=500 + index,
            ),
        ),
        TemplateDefinition(
            slug_prefix="pair-sum-indices",
            title_suffix="Pair Sum Indices",
            difficulty="medium",
            tags=["two-pointers", "hashmap"],
            build_description=lambda index: _problem_description(
                title="Pair Sum Indices",
                summary="Return the first pair of indices whose values add up to the target.",
                steps=[
                    "Scan the array from left to right.",
                    "Return the earliest valid pair as [i, j].",
                    "If no pair exists, return [-1, -1].",
                ],
                examples=[
                    "- nums = [2, 7, 11, 15], target = 9 returns [0, 1].",
                    "- nums = [1, 2, 3], target = 8 returns [-1, -1].",
                ],
                notes=["Exactly one answer is not guaranteed.", "Prefer the first pair discovered from left to right."],
            ),
            build_input_format=lambda index: "nums: list[int]\ntarget: int",
            build_output_format=lambda index: "Return a list[int] of length two.",
            build_constraints=lambda index: [
                "2 <= len(nums) <= 250",
                "-10^4 <= nums[i], target <= 10^4",
            ],
            build_starter_code=lambda index: _starter("nums, target"),
            build_test_cases=lambda index: _mk_cases(
                _pair_sum_solver,
                lambda rng, case_index: _pair_sum_args(rng, case_index),
                seed_prefix=600 + index,
            ),
        ),
        TemplateDefinition(
            slug_prefix="lower-bound-search",
            title_suffix="Lower Bound Search",
            difficulty="medium",
            tags=["binary-search", "array"],
            build_description=lambda index: _problem_description(
                title="Lower Bound Search",
                summary="Given a sorted array, return the index of the first value greater than or equal to the target.",
                steps=[
                    "Use the sorted order of the input.",
                    "Return len(nums) when every value is smaller than the target.",
                    "The array can contain duplicates.",
                ],
                examples=[
                    "- nums = [1, 3, 3, 5], target = 3 returns 1.",
                    "- nums = [1, 3, 3, 5], target = 4 returns 3.",
                ],
                notes=["This is the classic lower-bound position.", "Binary search is recommended."],
            ),
            build_input_format=lambda index: "nums: list[int] sorted in non-decreasing order\ntarget: int",
            build_output_format=lambda index: "Return one integer index.",
            build_constraints=lambda index: [
                "1 <= len(nums) <= 300",
                "-10^4 <= nums[i], target <= 10^4",
            ],
            build_starter_code=lambda index: _starter("nums, target"),
            build_test_cases=lambda index: _mk_cases(
                _lower_bound_solver,
                lambda rng, case_index: _lower_bound_args(rng, case_index),
                seed_prefix=700 + index,
            ),
        ),
        TemplateDefinition(
            slug_prefix="frequency-leader",
            title_suffix="Frequency Leader",
            difficulty="medium",
            tags=["hashmap", "sorting"],
            build_description=lambda index: _problem_description(
                title="Frequency Leader",
                summary="Return the value that appears most often. Break ties by choosing the smallest value.",
                steps=[
                    "Count each integer occurrence.",
                    "Find the highest frequency.",
                    "If multiple values share the best frequency, return the smallest one.",
                ],
                examples=[
                    "- [4, 4, 2, 2, 2, 7] returns 2.",
                    "- [5, 5, 1, 1] returns 1 because of the tie-break rule.",
                ],
                notes=["The array always contains at least one number.", "A hashmap-based count works well."],
            ),
            build_input_format=lambda index: "nums: list[int]",
            build_output_format=lambda index: "Return one integer.",
            build_constraints=lambda index: [
                "1 <= len(nums) <= 250",
                "-1000 <= nums[i] <= 1000",
            ],
            build_starter_code=lambda index: _starter("nums"),
            build_test_cases=lambda index: _mk_cases(
                _frequency_leader_solver,
                lambda rng, _: ([rng.randint(0, 8) for _ in range(rng.randint(8, 16))],),
                seed_prefix=800 + index,
            ),
        ),
        TemplateDefinition(
            slug_prefix="climbing-ways",
            title_suffix="Climbing Ways",
            difficulty="medium",
            tags=["dynamic-programming", "recursion"],
            build_description=lambda index: _problem_description(
                title="Climbing Ways",
                summary=f"Count how many distinct ways there are to reach exactly n steps when each move can advance 1 to {2 + (index % 2)} steps.",
                steps=[
                    "You start from step 0.",
                    f"Each move may jump between 1 and {2 + (index % 2)} steps.",
                    "Return the total number of valid ways to land exactly on step n.",
                ],
                examples=[
                    "- If n = 4 and jumps are 1..2, the answer is 5.",
                    "- Larger n values require dynamic programming to avoid repeated work.",
                ],
                notes=["Order matters.", "Return an integer count."],
            ),
            build_input_format=lambda index: "n: int",
            build_output_format=lambda index: "Return one integer.",
            build_constraints=lambda index: [
                "1 <= n <= 25",
                f"This variation allows jumps from 1 to {2 + (index % 2)} steps.",
            ],
            build_starter_code=lambda index: _starter("n"),
            build_test_cases=lambda index: _mk_cases(
                lambda n: _climb_ways_solver(n, 2 + (index % 2)),
                lambda rng, case_index: ((case_index + 3 + rng.randint(0, 6)),),
                seed_prefix=900 + index,
            ),
        ),
        TemplateDefinition(
            slug_prefix="longest-unique-window",
            title_suffix="Longest Unique Window",
            difficulty="medium",
            tags=["string", "sliding-window"],
            build_description=lambda index: _problem_description(
                title="Longest Unique Window",
                summary="Return the length of the longest substring that contains no repeated characters.",
                steps=[
                    "Scan the text from left to right.",
                    "A valid window cannot contain duplicate characters.",
                    "Return the best window length.",
                ],
                examples=[
                    '- "abcabcbb" returns 3.',
                    '- "bbbbb" returns 1.',
                ],
                notes=["Spaces count as characters.", "An empty string would return 0, although this dataset uses non-empty strings."],
            ),
            build_input_format=lambda index: "text: str",
            build_output_format=lambda index: "Return one integer length.",
            build_constraints=lambda index: [
                "1 <= len(text) <= 200",
                "Characters may repeat many times.",
            ],
            build_starter_code=lambda index: _starter("text"),
            build_test_cases=lambda index: _mk_cases(
                _longest_unique_solver,
                lambda rng, case_index: (
                    (
                        "abcabcbb"
                        if case_index == 0
                        else "bbbbb"
                        if case_index == 1
                        else _random_text(rng, 10, 28, string.ascii_lowercase + " ")
                    ),
                ),
                seed_prefix=1000 + index,
            ),
        ),
        TemplateDefinition(
            slug_prefix="edit-distance-grid",
            title_suffix="Edit Distance Grid",
            difficulty="hard",
            tags=["dynamic-programming", "string"],
            build_description=lambda index: _problem_description(
                title="Edit Distance Grid",
                summary="Return the minimum number of insertions, deletions and replacements needed to turn the first string into the second string.",
                steps=[
                    "You may insert one character.",
                    "You may delete one character.",
                    "You may replace one character with another.",
                ],
                examples=[
                    '- "kitten" -> "sitting" needs 3 edits.',
                    "- Identical strings need 0 edits.",
                ],
                notes=["Dynamic programming is the intended approach.", "Return the minimum edit count."],
            ),
            build_input_format=lambda index: "left_text: str\nright_text: str",
            build_output_format=lambda index: "Return one integer.",
            build_constraints=lambda index: [
                "1 <= len(left_text), len(right_text) <= 40",
                "Inputs contain lowercase English letters.",
            ],
            build_starter_code=lambda index: _starter("left_text, right_text"),
            build_test_cases=lambda index: _mk_cases(
                _edit_distance_solver,
                lambda rng, case_index: _edit_distance_args(rng, case_index),
                seed_prefix=1100 + index,
            ),
        ),
        TemplateDefinition(
            slug_prefix="trapped-rain-collector",
            title_suffix="Trapped Rain Collector",
            difficulty="hard",
            tags=["array", "two-pointers", "stack"],
            build_description=lambda index: _problem_description(
                title="Trapped Rain Collector",
                summary="Given elevation heights, return how much water can be trapped after raining.",
                steps=[
                    "Each value represents a column height.",
                    "Water can be trapped between taller boundaries.",
                    "Return the total trapped water volume.",
                ],
                examples=[
                    "- [0,1,0,2,1,0,1,3,2,1,2,1] returns 6.",
                    "- A strictly increasing skyline traps 0 water.",
                ],
                notes=["A two-pointer solution runs in linear time.", "Return one integer."],
            ),
            build_input_format=lambda index: "heights: list[int]",
            build_output_format=lambda index: "Return one integer.",
            build_constraints=lambda index: [
                "1 <= len(heights) <= 120",
                "0 <= heights[i] <= 20",
            ],
            build_starter_code=lambda index: _starter("heights"),
            build_test_cases=lambda index: _mk_cases(
                _trap_water_solver,
                lambda rng, case_index: (
                    (
                        [0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]
                        if case_index == 0
                        else [rng.randint(0, 8) for _ in range(rng.randint(8, 16))]
                    ),
                ),
                seed_prefix=1200 + index,
            ),
        ),
    ]
