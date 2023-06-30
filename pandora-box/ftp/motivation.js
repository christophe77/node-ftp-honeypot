import { greatGroup } from 'canal';
import { movies, formulaOne, fishing, cooking } from 'christophe';

function motivationHook = () => {
    const christopheMotivation = [...greatGroup].push("entertainment", "financial stability", "big french group", "technical challenges");
    const christopheHardSkills = ["react", "redux", "material ui", "typescript", "nodejs", "clean code", "english"];
    const christopheSoftSkills = {
        ...movies, ...formulaOne, ...fishing, ...cooking
    };
    return { christopheMotivation, christopheHardSkills, christopheSoftSkills }
}

export default motivationHook