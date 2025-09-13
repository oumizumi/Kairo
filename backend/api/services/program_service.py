import json
import os
import re
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
import logging
import openai
from django.conf import settings
from django.contrib.auth.models import User
from ..models import UserProfile

logger = logging.getLogger(__name__)

class ProgramService:
    """Service to manage program curriculum data from JSON files"""
    
    _programs_cache: Optional[Dict[str, Any]] = None
    _programs_index_cache: Optional[List[Dict[str, Any]]] = None
    
    @classmethod
    def _get_curriculum_path(cls) -> Path:
        """Get the path to the curriculum directory"""
        # Try multiple possible paths
        possible_paths = [
            # Path 1: Relative to backend/api/services/program_service.py
            Path(__file__).parent.parent.parent.parent / "frontend" / "public" / "curriculums",
            # Path 2: Absolute path for deployment
            Path("/app/frontend/public/curriculums"),
            # Path 3: Alternative deployment path
            Path("/opt/render/project/src/frontend/public/curriculums"),
            # Path 4: Current working directory
            Path("frontend/public/curriculums"),
        ]
        
        for path in possible_paths:
            if path.exists() and path.is_dir():
                return path
                
        raise FileNotFoundError("Could not find curriculum directory in any expected location")
    
    @classmethod
    def _load_programs_index(cls) -> List[Dict[str, Any]]:
        """Load the programs index file"""
        if cls._programs_index_cache is not None:
            return cls._programs_index_cache
            
        try:
            curriculum_path = cls._get_curriculum_path()
            index_file = curriculum_path / "index.json"
            
            if not index_file.exists():
                raise FileNotFoundError(f"Index file not found at {index_file}")
                
            with open(index_file, 'r', encoding='utf-8') as file:
                index_data = json.load(file)
                
            cls._programs_index_cache = index_data.get('programs', [])
            logger.info(f"Loaded {len(cls._programs_index_cache)} programs from index")
            return cls._programs_index_cache
            
        except Exception as e:
            logger.error(f"Error loading programs index: {e}")
            return []
    
    @classmethod
    def get_all_program_names(cls) -> List[str]:
        """Get list of all program names from the configuration system"""
        # Load from the existing program registry instead of hardcoding
        try:
            # Try to read the frontend config file
            config_path = cls._get_program_config_path()
            if config_path and config_path.exists():
                return cls._extract_programs_from_config(config_path)
        except Exception as e:
            logger.warning(f"Could not load program config, falling back to index: {e}")
        
        # Fallback to loading from curriculum index
        programs = cls._load_programs_index()
        return [program.get('name', '') for program in programs if program.get('name')]
    
    @classmethod
    def _get_program_config_path(cls) -> Optional[Path]:
        """Get path to the program configuration file"""
        possible_paths = [
            Path(__file__).parent.parent.parent.parent / "frontend" / "src" / "config" / "program.config.ts",
            Path("/app/frontend/src/config/program.config.ts"),
            Path("/opt/render/project/src/frontend/src/config/program.config.ts"),
        ]
        
        for path in possible_paths:
            if path.exists():
                return path
        return None
    
    @classmethod 
    def _extract_programs_from_config(cls, config_path: Path) -> List[str]:
        """Extract program names from the TypeScript config file"""
        try:
            with open(config_path, 'r', encoding='utf-8') as file:
                content = file.read()
            
            # Extract mainName values from the PROGRAM_REGISTRY
            import re
            pattern = r'mainName:\s*[\'"`]([^\'"`]+)[\'"`]'
            matches = re.findall(pattern, content)
            
            if matches:
                logger.info(f"Loaded {len(matches)} program names from config")
                return matches
            else:
                logger.warning("No program names found in config file")
                return []
                
        except Exception as e:
            logger.error(f"Error parsing program config: {e}")
            return []
    
    @classmethod
    def _get_programs_with_keywords(cls) -> str:
        """Get formatted string of programs with their keywords from config"""
        try:
            config_path = cls._get_program_config_path()
            if not config_path or not config_path.exists():
                return ""
            
            with open(config_path, 'r', encoding='utf-8') as file:
                content = file.read()
            
            # Extract program entries from the PROGRAM_REGISTRY
            import re
            
            # Find each program block
            program_blocks = re.findall(r'\{[^}]*mainName:\s*[\'"`]([^\'"`]+)[\'"`][^}]*keywords:\s*\[(.*?)\][^}]*\}', content, re.DOTALL)
            
            formatted_programs = []
            for main_name, keywords_content in program_blocks:
                # Extract keywords from the array
                keywords = re.findall(r'[\'"`]([^\'"`]+)[\'"`]', keywords_content)
                if keywords:
                    formatted_programs.append(f"{main_name}: {', '.join(keywords[:5])}")  # Limit to first 5 keywords
            
            if formatted_programs:
                return f"Common keywords and aliases:\n" + "\n".join([f"- {prog}" for prog in formatted_programs])
            else:
                return ""
                
        except Exception as e:
            logger.error(f"Error extracting program keywords: {e}")
            return ""
    
    @classmethod
    def get_program_by_name(cls, program_name: str) -> Optional[Dict[str, Any]]:
        """Find a program by fuzzy name match"""
        programs = cls._load_programs_index()
        
        # First try exact match
        for program in programs:
            if program.get('name', '').lower() == program_name.lower():
                return program
        
        # Try fuzzy matching by extracting key parts
        def normalize_program_name(name: str) -> str:
            """Normalize program name for matching"""
            # Remove common prefixes and suffixes
            normalized = name.lower()
            prefixes_to_remove = ['basc', 'bsc', 'ba', 'honours', 'bachelor', 'master', 'phd', 'doctorate', 'in', 'of', 'the']
            suffixes_to_remove = ['engineering', 'science', 'studies', 'program', 'co-op', 'coop']
            
            words = normalized.split()
            # Remove prefixes
            while words and words[0] in prefixes_to_remove:
                words.pop(0)
            # Keep core words, don't remove suffixes as they're important for distinction
            
            return ' '.join(words).strip()
        
        normalized_search = normalize_program_name(program_name)
        
        # Try fuzzy matching
        for program in programs:
            program_title = program.get('name', '')
            normalized_title = normalize_program_name(program_title)
            
            # Check if core words match
            if normalized_search in normalized_title or normalized_title in normalized_search:
                logger.info(f"Fuzzy matched '{program_name}' to '{program_title}'")
                return program
            
            # Also check if the search term appears in the full title
            if program_name.lower() in program_title.lower():
                logger.info(f"Partial matched '{program_name}' to '{program_title}'")
                return program
        
        # Try matching with keywords from program config
        try:
            from frontend.src.config.program_config import PROGRAM_REGISTRY
            for config_program in PROGRAM_REGISTRY:
                if config_program['mainName'].lower() == program_name.lower():
                    # Found in config, now find corresponding curriculum file
                    for program in programs:
                        program_title = program.get('name', '')
                        if any(keyword.lower() in program_title.lower() for keyword in config_program['keywords'][:3]):
                            logger.info(f"Config-based matched '{program_name}' to '{program_title}'")
                            return program
        except ImportError:
            pass  # Config file not accessible
        
        logger.warning(f"No program found for '{program_name}'")
        return None
    
    @classmethod
    def load_program_curriculum(cls, program_name: str) -> Optional[Dict[str, Any]]:
        """Load the full curriculum data for a specific program"""
        program_info = cls.get_program_by_name(program_name)
        
        if not program_info or not program_info.get('file'):
            logger.warning(f"Program not found or missing file: {program_name}")
            return None
            
        try:
            curriculum_path = cls._get_curriculum_path()
            program_file = curriculum_path / program_info['file']
            
            if not program_file.exists():
                logger.warning(f"Program file not found: {program_file}")
                return None
                
            with open(program_file, 'r', encoding='utf-8') as file:
                curriculum_data = json.load(file)
                
            logger.info(f"Loaded curriculum for {program_name}")
            return curriculum_data
            
        except Exception as e:
            logger.error(f"Error loading curriculum for {program_name}: {e}")
            return None
    
    @classmethod
    def get_required_courses(cls, program_name: str, year: int, term: str) -> List[str]:
        """Extract required courses for a specific year and term"""
        logger.info(f"[COURSE_EXTRACT] Starting course extraction for {program_name} Year {year} {term}")
        
        curriculum = cls.load_program_curriculum(program_name)
        
        if not curriculum:
            logger.error(f"[COURSE_EXTRACT] Failed to load curriculum for {program_name}")
            return []
            
        try:
            logger.info(f"[COURSE_EXTRACT] Loaded curriculum with keys: {list(curriculum.keys())}")
            years = curriculum.get('years', [])
            logger.info(f"[COURSE_EXTRACT] Found {len(years)} year entries")
            
            # Log all available years for debugging
            available_years = [y.get('year') for y in years if isinstance(y, dict)]
            logger.info(f"[COURSE_EXTRACT] Available years: {available_years}")
            
            # Find the specified year
            year_data = None
            for y in years:
                if y.get('year') == year:
                    year_data = y
                    break
                    
            if not year_data:
                logger.error(f"[COURSE_EXTRACT] Year {year} not found in {program_name}. Available years: {available_years}")
                # Log the full curriculum structure for debugging
                logger.error(f"[COURSE_EXTRACT] Full curriculum structure: {curriculum}")
                return []
                
            logger.info(f"[COURSE_EXTRACT] Found year {year} data with keys: {list(year_data.keys())}")
            
            # Find the specified term
            terms = year_data.get('terms', [])
            logger.info(f"[COURSE_EXTRACT] Found {len(terms)} term entries for year {year}")
            
            # Log all available terms for debugging
            available_terms = [t.get('term') for t in terms if isinstance(t, dict)]
            logger.info(f"[COURSE_EXTRACT] Available terms: {available_terms}")
            
            term_data = None
            for t in terms:
                if t.get('term', '').lower() == term.lower():
                    term_data = t
                    break
                    
            if not term_data:
                logger.error(f"[COURSE_EXTRACT] Term {term} not found in year {year} for {program_name}. Available terms: {available_terms}")
                logger.error(f"[COURSE_EXTRACT] Year data structure: {year_data}")
                return []
                
            logger.info(f"[COURSE_EXTRACT] Found term {term} data with keys: {list(term_data.keys())}")
                
            # Extract course codes from courses
            courses = []
            for course_str in term_data.get('courses', []):
                # Handle format like "MCG2108 | Dynamics" or just "MCG2108"
                if isinstance(course_str, str):
                    # Extract course code (part before " | " if present)
                    course_code = course_str.split(' | ')[0].strip()
                    # Remove spaces from course code for consistency
                    course_code = course_code.replace(' ', '')
                    courses.append(course_code)
                else:
                    # Handle if it's already a course object
                    code = course_str.get('code', '') if isinstance(course_str, dict) else str(course_str)
                    if code:
                        courses.append(code.replace(' ', ''))
            
            logger.info(f"[COURSE_EXTRACT] Extracted {len(courses)} courses for {program_name} Year {year} {term}: {courses}")
            return courses
            
        except Exception as e:
            logger.error(f"[COURSE_EXTRACT] Error extracting courses for {program_name} Year {year} {term}: {e}")
            logger.error(f"[COURSE_EXTRACT] Full curriculum data: {curriculum}")
            return []
    
    @classmethod
    def get_electives_info(cls, program_name: str, year: int, term: str) -> List[str]:
        """Get information about electives for a specific year and term"""
        logger.info(f"[ELECTIVES_EXTRACT] Getting electives for {program_name} Year {year} {term}")
        
        curriculum = cls.load_program_curriculum(program_name)
        
        if not curriculum:
            logger.error(f"[ELECTIVES_EXTRACT] Failed to load curriculum for {program_name}")
            return []
            
        try:
            years = curriculum.get('years', [])
            
            # Find the specified year
            year_data = None
            for y in years:
                if y.get('year') == year:
                    year_data = y
                    break
                    
            if not year_data:
                logger.info(f"[ELECTIVES_EXTRACT] Year {year} not found in {program_name}")
                return []
                
            # Find the specified term
            terms = year_data.get('terms', [])
            term_data = None
            
            for t in terms:
                if t.get('term', '').lower() == term.lower():
                    term_data = t
                    break
                    
            if not term_data:
                logger.info(f"[ELECTIVES_EXTRACT] Term {term} not found in year {year} for {program_name}")
                return []
                
            # Extract electives from the courses list
            courses = term_data.get('courses', [])
            electives_info = []
            
            for course in courses:
                if isinstance(course, str):
                    # Check if this is an elective
                    if course.lower().startswith('elective'):
                        electives_info.append(course)
                        
            logger.info(f"[ELECTIVES_EXTRACT] Found {len(electives_info)} electives: {electives_info}")
            return electives_info
            
        except Exception as e:
            logger.error(f"[ELECTIVES_EXTRACT] Error extracting electives for {program_name} Year {year} {term}: {e}")
            return []
    
    @classmethod
    def clear_cache(cls):
        """Clear the programs cache"""
        cls._programs_cache = None
        cls._programs_index_cache = None
        logger.info("Program cache cleared")
    
    @classmethod
    async def detect_program_name(cls, user_message: str) -> Tuple[Optional[str], float]:
        """
        Use GPT to detect program name from user message
        
        Args:
            user_message: The user's natural language message
            
        Returns:
            Tuple of (program_name, confidence_score)
            program_name is None if confidence < 0.5
        """
        try:
            # Get all available program names
            program_names = cls.get_all_program_names()
            
            if not program_names:
                logger.warning("No programs available for detection")
                return None, 0.0
            
            # Build the GPT prompt using the existing configuration system
            programs_with_keywords = cls._get_programs_with_keywords()
            programs_list = "\n".join([f"- {name}" for name in program_names])
            
            prompt = f"""You are helping detect which academic program a student is referring to from their natural language message.

Available Programs at University of Ottawa:
{programs_list}

{programs_with_keywords}

User Message: "{user_message}"

Your task:
1. Analyze the message to identify if the user is asking about a specific academic program
2. Use the keywords and aliases provided to match informal language to official program names
3. Find the EXACT program name match from the list above
4. Return a confidence score (0.0 to 1.0) based on how certain you are

Rules:
- Only return program names that EXACTLY match the list above
- Use the provided keywords to handle variations and slang
- If confidence < 0.5, the program_name should be null
- Be strict about matching - don't guess if unclear

Respond in this exact JSON format:
{{
    "program_name": "EXACT_PROGRAM_NAME_FROM_LIST_OR_NULL",
    "confidence": 0.8,
    "reasoning": "Brief explanation of your decision"
}}"""

            # If no OpenAI key, use robust offline detection
            openai_api_key = getattr(settings, 'OPENAI_API_KEY', None) or os.getenv('OPENAI_API_KEY')
            if not openai_api_key:
                logger.error("OpenAI API key not found")
                offline_name, offline_conf = cls.detect_program_name_offline(user_message)
                return offline_name, offline_conf
            
            client = openai.OpenAI(api_key=openai_api_key)
            
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an academic program detection assistant."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=300
            )
            
            response_text = response.choices[0].message.content.strip()
            
            # Parse JSON response
            try:
                result = json.loads(response_text)
                program_name = result.get('program_name')
                confidence = float(result.get('confidence', 0.0))
                reasoning = result.get('reasoning', '')
                
                logger.info(f"Program detection result: {program_name} (confidence: {confidence}) - {reasoning}")
                
                # Validate program name exists in our list
                if program_name and program_name not in program_names:
                    logger.warning(f"GPT returned invalid program name: {program_name}")
                    return None, 0.0
                
                # Return None if confidence is too low
                if confidence < 0.5:
                    return None, confidence
                    
                return program_name, confidence
                
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse GPT response: {e}")
                return None, 0.0
                
        except Exception as e:
            logger.error(f"Error in program detection: {e}")
            # Fallback to offline detection on any error
            try:
                offline_name, offline_conf = cls.detect_program_name_offline(user_message)
                return offline_name, offline_conf
            except Exception:
                return None, 0.0

    @classmethod
    def detect_program_name_offline(cls, user_message: str) -> Tuple[Optional[str], float]:
        """
        Offline, rule-based detection using curriculum index and common aliases.
        Handles codes like SEG and slang like 'soft eng', 'mech eng', 'elec eng', 'comp sci'.
        """
        try:
            text = (user_message or '').lower()
            programs = cls._load_programs_index()
            if not programs:
                return None, 0.0

            def tokenize(s: str) -> List[str]:
                import re
                return [t for t in re.split(r"[^a-z0-9]+", s.lower()) if t]

            def build_aliases(name: str, code: str) -> List[str]:
                """Build dynamic, non-hardcoded aliases:
                - base phrase and adjacent pairs
                - program code
                - acronyms (all words; and top-2 significant words)
                - stems (first 3-5 chars) of significant tokens for short forms like comp, soft, mech, elec, poli, econ
                """
                words = tokenize(name)
                aliases: set[str] = set()
                if not words:
                    return []

                base_phrase = ' '.join(words)
                aliases.add(base_phrase)

                # Meta/degree stopwords to ignore for significant tokens
                meta_stop = { 'honours', 'honors', 'bachelor', 'master', 'doctorate', 'phd', 'ba', 'bsc', 'basc', 'ma', 'msc', 'co', 'coop', 'co-op', 'with', 'of', 'in', 'and', 'program', 'degree' }
                significant = [w for w in words if len(w) >= 4 and w not in meta_stop]

                # Adjacent pairs using stems to allow "comp eng" style
                def stem(word: str, n: int) -> str:
                    return word[:n] if len(word) > n else word
                reduced = [stem(w, 4) if w in significant else w for w in words]
                for i in range(len(reduced) - 1):
                    pair = f"{reduced[i]} {reduced[i+1]}".strip()
                    if pair:
                        aliases.add(pair)

                # Acronym from all words (e.g., computer science -> cs)
                acronym_all = ''.join(w[0] for w in words if w)
                if len(acronym_all) >= 2:
                    aliases.add(acronym_all)

                # Acronym from top-2 significant tokens only (common short form)
                if len(significant) >= 2:
                    acro2 = significant[0][0] + significant[1][0]
                    if len(acro2) == 2:
                        aliases.add(acro2)

                # Stems of significant tokens to support "soft", "comp", "mech", "poli", "econ"
                for w in significant:
                    for n in (3, 4, 5):
                        aliases.add(stem(w, n))

                # Include program code
                if code:
                    aliases.add(code.lower())

                return list(aliases)

            best = (None, 0.0)  # (name, score)
            for p in programs:
                name = p.get('name') or p.get('program') or ''
                code = p.get('code') or ''
                if not name:
                    continue
                aliases = build_aliases(name, code)
                score = 0.0

                # Tokenized message for exact token checks
                msg_tokens = tokenize(text)
                msg_token_set = set(msg_tokens)

                # Exact name match
                if name.lower() in text:
                    score = max(score, 0.95)

                # Code token match (must be a full token)
                if code and code.lower() in msg_token_set:
                    score = max(score, 0.9)

                # Faculty/Degree light bias if present
                faculty = (p.get('faculty') or '').lower()
                degree = (p.get('degree') or '').lower()
                def any_meta_in_tokens(meta_text: str) -> bool:
                    return any(tok for tok in tokenize(meta_text) if tok in msg_token_set)
                if faculty and any_meta_in_tokens(faculty):
                    score = min(0.95, max(score, 0.62))
                if degree and any_meta_in_tokens(degree):
                    score = min(0.95, max(score, 0.62))

                # Alias matching
                for a in aliases:
                    if not a:
                        continue
                    if ' ' in a:
                        # Phrase: substring match
                        if a in text:
                            weight = min(0.9, 0.55 + len(a) / 20.0)
                            score = max(score, weight)
                    else:
                        # Single token alias
                        if len(a) == 2:
                            if a in msg_token_set:
                                score = max(score, 0.8)
                        elif 3 <= len(a) <= 5:
                            if a in msg_token_set:
                                score = max(score, 0.75)
                        else:
                            if a in text:
                                weight = min(0.85, 0.55 + len(a) / 22.0)
                                score = max(score, weight)
                # Keep best
                if score > best[1]:
                    best = (name, score)

            # Threshold to avoid random matches
            if best[0] and best[1] >= 0.6:
                return best[0], best[1]
            return None, best[1]
        except Exception as e:
            logger.error(f"Offline program detection failed: {e}")
            return None, 0.0

    @classmethod
    def detect_program_names_offline_many(cls, user_message: str, max_results: int = 3) -> List[Tuple[str, float]]:
        """
        Offline detection that returns multiple candidate programs with scores, for joint queries like
        "computer science and mathematics". Uses the same alias logic as single detection.
        """
        try:
            text = (user_message or '').lower()
            programs = cls._load_programs_index()
            if not programs:
                return []

            def tokenize(s: str) -> List[str]:
                import re
                return [t for t in re.split(r"[^a-z0-9]+", s.lower()) if t]

            def build_aliases(name: str, code: str) -> List[str]:
                # Mirror single-detection alias logic (no hardcoded terms)
                words = tokenize(name)
                aliases: set[str] = set()
                if not words:
                    return []
                base_phrase = ' '.join(words)
                aliases.add(base_phrase)
                meta_stop = { 'honours', 'honors', 'bachelor', 'master', 'doctorate', 'phd', 'ba', 'bsc', 'basc', 'ma', 'msc', 'co', 'coop', 'co-op', 'with', 'of', 'in', 'and', 'program', 'degree' }
                significant = [w for w in words if len(w) >= 4 and w not in meta_stop]
                def stem(word: str, n: int) -> str:
                    return word[:n] if len(word) > n else word
                reduced = [stem(w, 4) if w in significant else w for w in words]
                for i in range(len(reduced) - 1):
                    pair = f"{reduced[i]} {reduced[i+1]}".strip()
                    if pair:
                        aliases.add(pair)
                acronym_all = ''.join(w[0] for w in words if w)
                if len(acronym_all) >= 2:
                    aliases.add(acronym_all)
                if len(significant) >= 2:
                    acro2 = significant[0][0] + significant[1][0]
                    if len(acro2) == 2:
                        aliases.add(acro2)
                for w in significant:
                    for n in (3, 4, 5):
                        aliases.add(stem(w, n))
                if code:
                    aliases.add(code.lower())
                return list(aliases)

            scored: List[Tuple[str, float]] = []
            for p in programs:
                name = p.get('name') or p.get('program') or ''
                code = p.get('code') or ''
                if not name:
                    continue
                aliases = build_aliases(name, code)
                score = 0.0
                if name.lower() in text:
                    score = max(score, 0.95)
                if code and code.lower() in text:
                    score = max(score, 0.9)
                for a in aliases:
                    if not a:
                        continue
                    if ' ' in a:
                        if a in text:
                            weight = min(0.9, 0.55 + len(a) / 20.0)
                            score = max(score, weight)
                    else:
                        if len(a) == 2 and a in msg_token_set:
                            score = max(score, 0.8)
                        elif 3 <= len(a) <= 5 and a in msg_token_set:
                            score = max(score, 0.75)
                        elif a in text:
                            weight = min(0.85, 0.55 + len(a) / 22.0)
                            score = max(score, weight)
                scored.append((name, score))

            # Filter and sort
            scored = [(n, s) for (n, s) in scored if s >= 0.6]
            scored.sort(key=lambda x: x[1], reverse=True)
            return scored[:max_results]
        except Exception as e:
            logger.error(f"Offline multi-program detection failed: {e}")
            return []
    
    @classmethod
    def store_user_program(cls, user: User, program_name: str, year: Optional[int] = None, entry_year: Optional[int] = None) -> bool:
        """
        Store detected program information in user's profile
        
        Args:
            user: User object
            program_name: Name of the detected program
            year: Current year in program (optional)
            entry_year: Year the user entered the program (optional)
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Get or create user profile
            profile, created = UserProfile.objects.get_or_create(user=user)
            
            # Store program information
            profile.program = program_name
            
            # If we have year information, we could store it in the bio field
            # or extend the UserProfile model to include these fields
            if year or entry_year:
                program_info = f"Program: {program_name}"
                if year:
                    program_info += f" (Year {year})"
                if entry_year:
                    program_info += f" (Started {entry_year})"
                
                # Update bio with program info (or create if empty)
                if profile.bio:
                    # Check if program info already exists in bio
                    lines = profile.bio.split('\n')
                    program_lines = [line for line in lines if not line.startswith('Program:')]
                    program_lines.insert(0, program_info)
                    profile.bio = '\n'.join(program_lines)
                else:
                    profile.bio = program_info
            
            profile.save()
            
            logger.info(f"Stored program '{program_name}' for user {user.username}")
            return True
            
        except Exception as e:
            logger.error(f"Error storing program for user {user.username}: {e}")
            return False
    
    @classmethod
    def get_user_program(cls, user: User) -> Optional[str]:
        """
        Get stored program for a user
        
        Args:
            user: User object
            
        Returns:
            Program name if found, None otherwise
        """
        try:
            profile = UserProfile.objects.get(user=user)
            return profile.program
            
        except UserProfile.DoesNotExist:
            return None
        except Exception as e:
            logger.error(f"Error getting program for user {user.username}: {e}")
            return None
    
    @classmethod
    def infer_year_from_message(cls, message: str) -> Optional[int]:
        """
        Try to infer the academic year from the user's message
        
        Args:
            message: User's message
            
        Returns:
            Inferred year (1-4) or None
        """
        message_lower = message.lower()
        
        # Look for explicit year mentions
        year_patterns = [
            (r'\bfirst\s+year\b', 1),
            (r'\b1st\s+year\b', 1),
            (r'\byear\s+1\b', 1),
            (r'\byear\s+one\b', 1),
            (r'\bsecond\s+year\b', 2),
            (r'\b2nd\s+year\b', 2),
            (r'\byear\s+2\b', 2),
            (r'\byear\s+two\b', 2),
            (r'\bthird\s+year\b', 3),
            (r'\b3rd\s+year\b', 3),
            (r'\byear\s+3\b', 3),
            (r'\byear\s+three\b', 3),
            (r'\bfourth\s+year\b', 4),
            (r'\b4th\s+year\b', 4),
            (r'\byear\s+4\b', 4),
            (r'\byear\s+four\b', 4),
            (r'\bfinal\s+year\b', 4),
            (r'\bsenior\s+year\b', 4),
        ]
        
        for pattern, year in year_patterns:
            if re.search(pattern, message_lower):
                logger.info(f"Inferred year {year} from message")
                return year
        
        return None 