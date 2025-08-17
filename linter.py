import sys
import re
import json

def extract_vars_from_expr(expr):
    """Extract all $variables used in an expression."""
    return re.findall(r'\$[a-zA-Z_][a-zA-Z0-9_]*', expr)


def extract_definitions_from_expr(expr):
    defined = set()
    expr = expr.strip()
    if expr.startswith("(match ") or expr.startswith("( match "):
        # Match expressions can define variables
        matches = re.findall(r'\(\s*([a-zA-Z_][a-zA-Z0-9_]*)\s', expr)
        defined.update(matches)
    elif expr.startswith("(let "):
        # Handle (let $x expr body)
        match = re.match(r'\(let\s+(\$[a-zA-Z_][a-zA-Z0-9_]*)\s', expr)
        if match:
            defined.add(match.group(1))
    elif expr.startswith("(let*"):
        # Handle (let* (( $x expr ) ($y expr )) body...)
        matches = re.findall(r'\(\s*(\$[a-zA-Z_][a-zA-Z0-9_]*)\s', expr)
        defined.update(matches)
    elif expr.startswith("(="):
        # Handle (= (fn $x $y) body...)
        match = re.match(r'\(=\s*\((.*?)\)', expr, re.DOTALL)
        if match:
            args = match.group(1)
            defined.update(extract_vars_from_expr(args))
    return defined


def is_complete_expr(expr):
    """Check if parentheses are balanced in the expression."""
    count = 0
    for char in expr:
        if char == '(':
            count += 1
        elif char == ')':
            count -= 1
    return count == 0

def lint_metta_code(code):
    issues = []
    lines = code.splitlines()
    defined_vars = set()
    used_vars = set()

    expr = ""
    expr_start_line = 0

    for lineno, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            continue

        if not expr:
            expr_start_line = lineno

        expr += line + "\n"

        if is_complete_expr(expr):
            # Check this complete s-expression
            used_in_expr = extract_vars_from_expr(expr)
            defined_in_expr = extract_definitions_from_expr(expr)

            defined_vars.update(defined_in_expr)

            for var in used_in_expr:
                if var not in defined_vars and var not in defined_in_expr:
                    issues.append({
                        "line": expr_start_line + 1,
                        "message": f"Variable '{var}' used without definition"
                    })

            expr = ""  # reset

    return issues

if __name__ == "__main__":
    path = sys.argv[1]
    with open(path) as f:
        code = f.read()
    errors = lint_metta_code(code)
    print(json.dumps(errors, indent=2))
