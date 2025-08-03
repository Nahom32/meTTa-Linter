import sys
import re
import json

def extract_vars_from_expr(expr):
    """Extract all $variables in a single meTTa expression."""
    return re.findall(r'\$[a-zA-Z0-9_]+', expr)

def extract_definitions_from_expr(expr):
    """Find variables that are defined in argument positions or in let/let* expressions."""
    defined = set()
    if expr.strip().startswith("(="):
        parts = expr.strip()[2:-1].split(None, 2)  # remove '(=' and ')' and split
        if len(parts) >= 2:
            head = parts[1]
            defined.update(extract_vars_from_expr(head))
    elif expr.strip().startswith("(let") or expr.strip().startswith("(let*"):
        bindings = re.findall(r'\(\$[a-zA-Z0-9_]+\s', expr)
        for b in bindings:
            defined.add(b[1:-1].strip())  # strip parentheses and space
    return defined

def lint_metta_code(code):
    issues = []
    lines = code.splitlines()
    defined_vars = set()
    used_vars = set()

    for lineno, line in enumerate(lines):
        line = line.strip()
        if not line or line.startswith(";"):  # skip empty lines and comments
            continue

        # Find variable usage
        used_in_line = extract_vars_from_expr(line)
        used_vars.update(used_in_line)

        # Find variable definitions
        defined_in_line = extract_definitions_from_expr(line)
        defined_vars.update(defined_in_line)

        # Look for undefined variables
        for var in used_in_line:
            if var not in defined_vars:
                issues.append({
                    "line": lineno + 1,
                    "message": f"Variable '{var}' used without definition"
                })

    # (Optional) Warn about unused variables
    unused = defined_vars - used_vars
    for var in unused:
        issues.append({
            "line": 0,
            "message": f"Variable '{var}' defined but never used"
        })

    return issues

if __name__ == "__main__":
    path = sys.argv[1]
    with open(path) as f:
        code = f.read()
    errors = lint_metta_code(code)
    print(json.dumps(errors, indent=2))
